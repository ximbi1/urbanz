import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Coordinate } from '@/types/territory';
import {
  calculatePathDistance,
  isPolygonClosed,
  calculatePolygonArea,
  calculateAveragePace,
} from '@/utils/geoCalculations';
import {
  filterGPSPointsByAccuracy,
  smoothPath,
  validateRun,
  limitPathPoints,
  GPSPoint,
} from '@/utils/runValidation';
import { enqueueOfflineRun } from '@/utils/offlineQueue';
import { calculateLevel } from '@/utils/levelSystem';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useAchievements } from './useAchievements';
import { usePlayerSettings } from '@/hooks/usePlayerSettings';
import { startRunTrackingService, stopRunTrackingService } from '@/lib/runTracking';
import { updateActiveDuels } from './run/runGamification';
import { extractLoops } from './run/runLoops';
import { useAdaptiveGPS } from './useAdaptiveGPS';
import { generateSimulatedRun } from '@/utils/runSimulator';

export const useRun = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [runPath, setRunPath] = useState<Coordinate[]>([]);
  const [duration, setSuration] = useState(0);
  const [distance, setDistance] = useState(0);
  const [useGPS, setUseGPS] = useState(false);
  const [watchId, setWatchId] = useState<string | number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedTime, setPausedTime] = useState(0);
  const [lastPauseTime, setLastPauseTime] = useState<number | null>(null);
  const { user } = useAuth();
  const { checkAndUnlockAchievements } = useAchievements();
  const { settings: playerSettings } = usePlayerSettings();
  const adaptiveGPS = useAdaptiveGPS({
    minDistanceMeters: 5,
    minTimeMs: 2000,
    maxAccuracyMeters: 25,
  });
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const isAndroid = platform === 'android';

  const enableKeepAwake = useCallback(async () => {
    if (!isNative) return;
    try {
      await KeepAwake.keepAwake();
    } catch (error) {
      console.warn('No se pudo activar KeepAwake', error);
    }
  }, [isNative]);

  const allowSleep = useCallback(async () => {
    if (!isNative) return;
    try {
      await KeepAwake.allowSleep();
    } catch (error) {
      console.warn('No se pudo desactivar KeepAwake', error);
    }
  }, [isNative]);

  const triggerHaptic = useCallback(async (type: 'start' | 'pause' | 'resume' | 'stop') => {
    if (!isNative) return;
    try {
      if (type === 'start' || type === 'resume') {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } else if (type === 'pause') {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else if (type === 'stop') {
        await Haptics.notification({ type: NotificationType.Success });
      }
    } catch (error) {
      console.warn('Error al ejecutar haptics', error);
    }
  }, [isNative]);

  const startForegroundService = useCallback(() => {
    if (!isAndroid) return;
    startRunTrackingService();
  }, [isAndroid]);

  const stopForegroundService = useCallback(() => {
    if (!isAndroid) return;
    stopRunTrackingService();
  }, [isAndroid]);

  const handleGPSPosition = useCallback((position: GeolocationPosition) => {
    const accuracy = position.coords.accuracy;
    const newPoint: Coordinate = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    // Usar GPS adaptativo para filtrar puntos y ahorrar batería
    const result = adaptiveGPS.recordPoint(newPoint, accuracy ?? undefined, Date.now());
    
    if (!result.recorded) {
      return; // Punto filtrado por GPS adaptativo
    }

    setRunPath(prev => {
      const updated = [...prev, newPoint];
      
      if (result.distance > 0) {
        setDistance(d => d + result.distance);
      }

      if (updated.length >= 4 && isPolygonClosed(updated)) {
        toast.success('¡Polígono cerrado! 🎯', {
          description: 'Puedes conquistar este territorio'
        });
      }

      return updated;
    });
  }, [adaptiveGPS]);

  const clearGPSWatch = useCallback(async () => {
    if (watchId === null) return;
    try {
      if (typeof watchId === 'string') {
        await Geolocation.clearWatch({ id: watchId });
      } else if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    } catch (error) {
      console.warn('Error limpiando el watch de GPS', error);
    } finally {
      setWatchId(null);
    }
  }, [watchId]);

  // Calcular duración basada en timestamps reales
  useEffect(() => {
    let interval: number | undefined;
    if (isRunning && !isPaused && startTime) {
      interval = window.setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime - pausedTime) / 1000);
        setSuration(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, isPaused, startTime, pausedTime]);

  useEffect(() => {
    return () => {
      clearGPSWatch();
    };
  }, [clearGPSWatch]);

  const startRun = useCallback((gpsMode: boolean = false) => {
    const now = Date.now();
    setIsRunning(true);
    setIsPaused(false);
    setRunPath([]);
    setSuration(0);
    setDistance(0);
    setStartTime(now);
    setPausedTime(0);
    setLastPauseTime(null);
    setUseGPS(gpsMode);
    adaptiveGPS.reset(); // Reset GPS adaptativo
    enableKeepAwake();
    triggerHaptic('start');
    startForegroundService();

    if (gpsMode) {
      if (isNative) {
        Geolocation.watchPosition({ enableHighAccuracy: true }, (position, error) => {
          if (error) {
            console.error('GPS Error (nativo):', error);
            toast.error('Error obteniendo ubicación nativa');
            return;
          }
          if (position) {
            const webPosition = {
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
                toJSON() { return this; },
              },
              timestamp: position.timestamp,
              toJSON() { return this; },
            } as GeolocationPosition;
            handleGPSPosition(webPosition);
          }
        })
          .then(id => setWatchId(id))
          .catch(error => {
            console.error('No se pudo iniciar el GPS nativo', error);
            toast.error('No se pudo iniciar el GPS nativo');
            setUseGPS(false);
          });
      } else if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        const id = navigator.geolocation.watchPosition(
          (position) => {
            handleGPSPosition(position);
          },
          (error) => {
            console.error('GPS Error:', error);
            toast.error('Error obteniendo ubicación GPS');
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000,
          }
        );
        setWatchId(id);
      } else {
        toast.error('Geolocalización no disponible');
        setUseGPS(false);
      }
    }

    toast.success('¡Carrera iniciada!');
  }, [adaptiveGPS, enableKeepAwake, handleGPSPosition, isNative, startForegroundService, triggerHaptic]);

  const pauseRun = useCallback(() => {
    setIsPaused(true);
    setLastPauseTime(Date.now());
    triggerHaptic('pause');
    toast.info('Carrera pausada');
  }, [triggerHaptic]);

  const resumeRun = useCallback(() => {
    if (lastPauseTime) {
      const pauseDuration = Date.now() - lastPauseTime;
      setPausedTime(prev => prev + pauseDuration);
      setLastPauseTime(null);
    }
    setIsPaused(false);
    triggerHaptic('resume');
    toast.success('Carrera reanudada');
  }, [lastPauseTime, triggerHaptic]);

  const addPoint = useCallback((point: Coordinate) => {
    if (!isRunning || isPaused || useGPS) return;
    
    setRunPath(prev => {
      const updated = [...prev, point];
      if (prev.length > 0) {
        const newDist = calculatePathDistance([prev[prev.length - 1], point]);
        setDistance(d => d + newDist);
      }

      // Verificar si se cerró un polígono
      if (updated.length >= 4 && isPolygonClosed(updated)) {
        toast.success('¡Polígono cerrado! 🎯', {
          description: 'Puedes conquistar este territorio'
        });
      }

      return updated;
    });
  }, [isRunning, isPaused, useGPS]);

  const stopRun = useCallback(async (isPublic: boolean = false) => {
    await clearGPSWatch();
    allowSleep();
    triggerHaptic('stop');
    stopForegroundService();

    if (!user) {
      toast.error('Debes iniciar sesión para guardar carreras');
      return;
    }

    setIsSaving(true);
    toast.loading('Guardando carrera...', { id: 'saving-run' });

    let conquered = 0;
    let stolen = 0;
    let lost = 0;
    let pointsGained = 0;
    let runIdentifier: string | null = null;

    // Suavizar ruta antes de procesar
    const normalizedPath = limitPathPoints(smoothPath(runPath), 400);
    const smoothedDistance = calculatePathDistance(normalizedPath);

    const loops = extractLoops(normalizedPath);

    // Obtener nivel del usuario
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('total_points')
      .eq('id', user.id)
      .single();

    const userLevel = userProfile ? calculateLevel(userProfile.total_points).level : 1;

    // Procesar cada bucle como territorio independiente
    for (const loopPath of loops) {
      const loopDistance = calculatePathDistance(loopPath);
      const durationShare = smoothedDistance > 0 ? (duration * (loopDistance / smoothedDistance)) : duration;

      if (loopPath.length < 4) continue;

      const area = calculatePolygonArea(loopPath);
      const avgPace = calculateAveragePace(loopDistance, durationShare);

      const validation = validateRun(loopPath, durationShare, area, userLevel);
      if (!validation.isValid) {
        toast.error('Carrera no válida', {
          description: validation.errors.join('. '),
        });
        setIsSaving(false);
        setIsRunning(false);
        setIsPaused(false);
        return;
      }

        const saveOfflineRun = () => {
          enqueueOfflineRun(
            {
              path: loopPath,
              duration: durationShare,
              source: useGPS ? 'live' : 'manual',
              userId: user.id,
            },
            {
              createdAt: new Date().toISOString(),
              distance: loopDistance,
              area,
              avgPace,
            }
          );
          toast.info('Carrera guardada offline', {
            description: 'Se sincronizará automáticamente cuando vuelvas a tener conexión',
          });
          setIsSaving(false);
          setIsRunning(false);
          setIsPaused(false);
        };

      try {
        if (playerSettings?.explorerMode) {
          await supabase
            .from('explorer_territories')
            .insert([{
              user_id: user.id,
              path: normalizedPath as unknown as import('@/integrations/supabase/types').Json,
              distance: smoothedDistance,
              duration,
              metadata: { source: useGPS ? 'live' : 'manual' },
            }]);
          toast.success('Ruta guardada en modo explorador');
          setIsSaving(false);
          setIsRunning(false);
          setIsPaused(false);
          return {
            conquered,
            stolen,
            lost,
            pointsGained,
            run: {
              id: runIdentifier ?? `run-${Date.now()}`,
              userId: user.id,
              path: normalizedPath,
              distance: smoothedDistance,
              duration,
              avgPace: calculateAveragePace(smoothedDistance, duration),
              territoriesConquered: 0,
              territoriesStolen: 0,
              territoriesLost: 0,
              pointsGained: 0,
              timestamp: Date.now(),
            },
          };
        }

        const { data: claimResult, error: claimError } = await supabase.functions.invoke('process-territory-claim', {
          body: {
            path: loopPath,
            duration: durationShare,
            source: useGPS ? 'live' : 'manual',
            isPublic,
          },
        });

        if (claimError) {
          if (!navigator.onLine || claimError.message?.toLowerCase().includes('fetch')) {
            saveOfflineRun();
            return null;
          }
          toast.error('No se pudo procesar el territorio', {
            description: claimError.message || 'Inténtalo de nuevo más tarde',
          });
          setIsSaving(false);
          setIsRunning(false);
          setIsPaused(false);
          return;
        }

        if (!claimResult?.success) {
          toast.error('La carrera no se pudo guardar', {
            description: (claimResult as any)?.error || 'Error desconocido',
          });
          setIsSaving(false);
          setIsRunning(false);
          setIsPaused(false);
          return;
        }

        const resultData = claimResult.data;
        conquered += resultData?.territoriesConquered ?? 0;
        stolen += resultData?.territoriesStolen ?? 0;
        lost += resultData?.territoriesLost ?? 0;
        pointsGained += resultData?.pointsGained ?? 0;
        runIdentifier = runIdentifier ?? resultData?.runId ?? null;

        if (resultData?.challengeRewards?.length) {
          toast.success('🏅 Desafío del mapa completado', {
            description: resultData.challengeRewards.join(', '),
          });
        }

        if (resultData?.missionsCompleted?.length) {
          const rewardParts: string[] = [];
          if (resultData.missionRewards?.points) {
            rewardParts.push(`+${resultData.missionRewards.points} pts`);
          }
          if (resultData.missionRewards?.shields) {
            rewardParts.push(`+${resultData.missionRewards.shields} escudo`);
          }
          toast.success('✅ Misión completada', {
            description: `${resultData.missionsCompleted.join(', ')}${rewardParts.length ? ' · ' + rewardParts.join(' · ') : ''}`,
          });
        }

        if (resultData?.clanMissionsCompleted?.length) {
          toast.success('🤝 ¡Tu clan completó una misión!', {
            description: resultData.clanMissionsCompleted.join(', '),
          });
        }

        if (resultData?.action === 'stolen') {
          toast.success('🔥 ¡Territorio robado!', {
            description: 'Has conquistado un territorio enemigo',
          });
        } else if (resultData?.action === 'reinforced') {
          toast.info('Territorio reforzado', {
            description: 'Has renovado un territorio que ya te pertenecía',
          });
        } else {
          toast.success('🎉 ¡Territorio conquistado!', {
            description: `Área: ${Math.round(area)} m²`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!navigator.onLine || message.toLowerCase().includes('failed to fetch')) {
          saveOfflineRun();
          return null;
        }
        console.error('Error guardando territorio:', error);
        toast.error('Error al guardar el territorio', { id: 'saving-run' });
        setIsSaving(false);
        return;
      }
    }

    // Actualizar progreso de desafíos
    try {
      const { data: participations, error: participationsError } = await supabase
        .from('challenge_participations')
        .select(`
          *,
          challenge:challenges (type, target_value)
        `)
        .eq('user_id', user.id)
        .eq('completed', false);

      if (!participationsError && participations) {
        for (const participation of participations) {
          let newProgress = participation.current_progress;
          const challenge = participation.challenge as any;

          if (challenge.type === 'distance') {
            newProgress += Math.round(smoothedDistance);
          } else if (challenge.type === 'territories') {
            newProgress += conquered;
          } else if (challenge.type === 'points') {
            newProgress += pointsGained;
          }

          const isCompleted = newProgress >= challenge.target_value;

          await supabase
            .from('challenge_participations')
            .update({
              current_progress: newProgress,
              completed: isCompleted,
              completed_at: isCompleted ? new Date().toISOString() : null,
            })
            .eq('id', participation.id);

            if (isCompleted) {
              toast.success('🏆 ¡Desafío completado!', {
                description: `Has ganado ${challenge.reward_points} puntos extra`,
              });

              // Dar puntos de recompensa
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('total_points, season_points, historical_points')
                .eq('id', user.id)
                .single();

              if (currentProfile) {
                await supabase
                  .from('profiles')
                  .update({
                    total_points: currentProfile.total_points + challenge.reward_points,
                    season_points: (currentProfile.season_points || 0) + challenge.reward_points,
                    historical_points: (currentProfile.historical_points || 0) + challenge.reward_points,
                  })
                  .eq('id', user.id);
              }

              // Otorgar un escudo gratis
              await supabase
                .from('user_shields')
                .insert({
                  user_id: user.id,
                  source: 'challenge',
                  charges: 1,
                });

            // Crear notificación de desafío completado
            await supabase
              .from('notifications')
              .insert({
                user_id: user.id,
                type: 'challenge_completed',
                title: '¡Desafío completado!',
                message: `Has completado el desafío y ganado ${challenge.reward_points} puntos extra`,
                related_id: participation.challenge_id
              });
          }
        }
      }
    } catch (error) {
      console.error('Error actualizando desafíos:', error);
    }

    if (user) {
      await updateActiveDuels(user.id, smoothedDistance, pointsGained, conquered + stolen);
    }

    toast.success('¡Carrera guardada exitosamente!', { id: 'saving-run' });
    setIsSaving(false);
    setIsRunning(false);
    setIsPaused(false);
    setUseGPS(false);

    // Verificar y desbloquear logros después de guardar la carrera
    setTimeout(() => {
      checkAndUnlockAchievements();
    }, 1000);

    return {
      conquered,
      stolen,
      lost,
      pointsGained,
      run: {
        id: runIdentifier ?? `run-${Date.now()}`,
        userId: user.id,
        path: normalizedPath,
        distance: smoothedDistance,
        duration,
        avgPace: calculateAveragePace(smoothedDistance, duration),
        territoriesConquered: conquered,
        territoriesStolen: stolen,
        territoriesLost: lost,
        pointsGained,
        timestamp: Date.now(),
      },
    };
  }, [allowSleep, checkAndUnlockAchievements, clearGPSWatch, duration, playerSettings, runPath, stopForegroundService, triggerHaptic, updateActiveDuels, user, useGPS]);

  const simulateRun = useCallback((centerLat?: number, centerLng?: number) => {
    const simulated = generateSimulatedRun(centerLat, centerLng);
    
    setRunPath(simulated.path);
    setDistance(simulated.distance);
    setSuration(simulated.duration);
    setIsRunning(true);
    setIsPaused(false);
    setUseGPS(false);
    setStartTime(Date.now() - simulated.duration * 1000);
    setPausedTime(0);
    
    toast.success('🧪 Carrera simulada generada', {
      description: `${(simulated.distance / 1000).toFixed(2)} km en ${Math.floor(simulated.duration / 60)} min`,
    });
  }, []);

  return {
    isRunning,
    isPaused,
    runPath,
    duration,
    distance,
    useGPS,
    isSaving,
    startRun,
    pauseRun,
    resumeRun,
    addPoint,
    stopRun,
    simulateRun,
  };
};
