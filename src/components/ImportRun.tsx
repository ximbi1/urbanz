import { useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { parseGPX, parseTCX, detectFileType, gpsPointsToCoordinates, ParsedActivity } from '@/utils/gpxParser';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { calculatePolygonArea, isPolygonClosed, calculateAveragePace, calculatePathDistance } from '@/utils/geoCalculations';
import { validateRun } from '@/utils/runValidation';
import { Coordinate } from '@/types/territory';
import { calculateLevel } from '@/utils/levelSystem';

// Verificar si una fecha está en la semana actual (lunes-domingo)
const isInCurrentWeek = (date: Date): boolean => {
  const now = new Date();
  const mondayOfThisWeek = new Date(now);
  mondayOfThisWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  mondayOfThisWeek.setHours(0, 0, 0, 0);
  
  const sundayOfThisWeek = new Date(mondayOfThisWeek);
  sundayOfThisWeek.setDate(mondayOfThisWeek.getDate() + 6);
  sundayOfThisWeek.setHours(23, 59, 59, 999);
  
  return date >= mondayOfThisWeek && date <= sundayOfThisWeek;
};

// Generar hash único para una carrera
const generateRunHash = (path: Coordinate[], timestamp: Date): string => {
  const pathStr = path.slice(0, 10).map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
  return `${pathStr}_${timestamp.getTime()}`;
};

interface ImportRunProps {
  onImportComplete?: () => void;
}

export const ImportRun = ({ onImportComplete }: ImportRunProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedActivity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setParsedData(null);

    try {
      const fileType = detectFileType(file);
      
      if (fileType === 'unknown') {
        throw new Error('Formato de archivo no compatible. Usa GPX o TCX.');
      }

      const content = await file.text();
      
      let parsed: ParsedActivity;
      if (fileType === 'gpx') {
        parsed = parseGPX(content);
      } else {
        parsed = parseTCX(content);
      }

      setParsedData(parsed);
      toast.success('Archivo cargado exitosamente');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedData) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      // Validar que sea de la semana actual
      if (!isInCurrentWeek(parsedData.startTime)) {
        throw new Error('Solo se pueden importar carreras de la semana actual (lunes a domingo)');
      }

      // Convertir a coordenadas
      const path = gpsPointsToCoordinates(parsedData.points);
      
      // Verificar duplicados
      const runHash = generateRunHash(path, parsedData.startTime);
      const { data: existingRuns } = await supabase
        .from('runs')
        .select('id, created_at, path')
        .eq('user_id', user.id);
      
      if (existingRuns) {
        for (const run of existingRuns) {
          const runPath = run.path as any as Coordinate[];
          const runDate = new Date(run.created_at);
          const existingHash = generateRunHash(runPath, runDate);
          
          if (existingHash === runHash) {
            throw new Error('Esta carrera ya ha sido importada anteriormente');
          }
        }
      }

      // Obtener perfil del usuario
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_points')
        .eq('id', user.id)
        .single();

      if (!profile) {
        throw new Error('No se encontró el perfil del usuario');
      }

      const userLevel = calculateLevel(profile.total_points).level;

      if (!isPolygonClosed(path, 100)) {
        throw new Error('La ruta no forma un polígono cerrado. Asegúrate de que el inicio y el final estén cerca (máx. 100m)');
      }

      const distanceMeters = calculatePathDistance(path);
      const area = calculatePolygonArea(path);
      const avgPace = calculateAveragePace(distanceMeters, parsedData.duration);

      const validation = validateRun(path, parsedData.duration, area, userLevel);

      if (!validation.isValid) {
        throw new Error(`Carrera no válida: ${validation.errors.join(', ')}`);
      }

      const { data: claimResult, error: claimError } = await supabase.functions.invoke('process-territory-claim', {
        body: {
          path,
          duration: parsedData.duration,
          source: 'import',
        },
      });

      if (claimError || !claimResult?.success) {
        throw new Error(claimError?.message || (claimResult as any)?.error || 'No se pudo guardar la carrera importada');
      }

      const resultData = claimResult.data;
      const territoriesConquered = resultData?.territoriesConquered ?? 0;
      const territoriesStolen = resultData?.territoriesStolen ?? 0;
      const pointsGained = resultData?.pointsGained ?? 0;

      if (resultData?.challengeRewards?.length) {
        toast.success('🏅 Desafío del mapa completado', {
          description: resultData.challengeRewards.join(', '),
        });
      }

      if (resultData?.action === 'stolen') {
        toast.success('🔥 ¡Territorio robado desde importación!', {
          description: 'Has conquistado un territorio enemigo con tu archivo GPS',
        });
      } else if (resultData?.action === 'reinforced') {
        toast.info('Territorio reforzado mediante importación');
      } else {
        toast.success('🎉 ¡Territorio conquistado desde importación!');
      }

      // Actualizar progreso de desafíos semanales
      try {
        const { data: participations, error: participationsError } = await supabase
          .from('challenge_participations')
          .select(`
            *,
            challenge:challenges (type, target_value, reward_points)
          `)
          .eq('user_id', user.id)
          .eq('completed', false);

        if (!participationsError && participations) {
          for (const participation of participations) {
            let newProgress = participation.current_progress;
            const challenge = participation.challenge as any;

            if (challenge.type === 'distance') {
              newProgress += Math.round(distanceMeters);
            } else if (challenge.type === 'territories') {
              newProgress += (territoriesConquered + territoriesStolen);
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

              await supabase
                .from('user_shields')
                .insert({ user_id: user.id, source: 'challenge', charges: 1 });

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
      } catch (challengeError) {
        console.error('Error actualizando desafíos:', challengeError);
        // No lanzar error, la carrera ya se guardó correctamente
      }

      await updateActiveDuels(Math.round(parsedData.totalDistance), pointsGained, territoriesConquered + territoriesStolen);

      toast.success(`¡Carrera importada! ${territoriesConquered} territorios conquistados, ${territoriesStolen} robados.`);
      setParsedData(null);
      onImportComplete?.();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al importar';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const updateActiveDuels = async (distanceValue: number, pointsValue: number, territoriesValue: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const { data: activeDuels } = await supabase
        .from('duels')
        .select('*')
        .eq('status', 'active')
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`);

      if (!activeDuels) return;

      for (const duel of activeDuels as any[]) {
        const isChallenger = duel.challenger_id === user.id;
        let increment = 0;

        if (duel.duel_type === 'distance') increment = distanceValue;
        else if (duel.duel_type === 'points') increment = pointsValue;
        else if (duel.duel_type === 'territories') increment = territoriesValue;

        if (increment <= 0) continue;

        const progressField = isChallenger ? 'challenger_progress' : 'opponent_progress';
        const newProgress = (duel[progressField] || 0) + increment;
        const updates: Record<string, any> = { [progressField]: newProgress };
        let completed = false;

        if (newProgress >= duel.target_value) {
          updates.status = 'completed';
          updates.winner_id = user.id;
          completed = true;
        }

        await supabase
          .from('duels')
          .update(updates)
          .eq('id', duel.id);

        if (completed) toast.success('🏁 ¡Has ganado un duelo!');
      }
    } catch (error) {
      console.error('Error actualizando duelos (import)', error);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Importar Carrera GPS</h3>
          <p className="text-sm text-muted-foreground">
            Sube un archivo GPX o TCX de tu reloj GPS (Garmin, Polar, Suunto, etc.)
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!parsedData ? (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".gpx,.tcx"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              disabled={isUploading}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                {isUploading ? 'Cargando...' : 'Haz clic para seleccionar archivo'}
              </p>
              <p className="text-xs text-muted-foreground">
                GPX o TCX (máx. 10MB)
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">{parsedData.name}</h4>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Distancia</p>
                  <p className="font-medium">{(parsedData.totalDistance / 1000).toFixed(2)} km</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duración</p>
                  <p className="font-medium">
                    {Math.floor(parsedData.duration / 60)}:{String(Math.floor(parsedData.duration % 60)).padStart(2, '0')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Puntos GPS</p>
                  <p className="font-medium">{parsedData.points.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p className="font-medium">{parsedData.startTime.toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleConfirmImport}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? 'Procesando...' : 'Confirmar Importación'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setParsedData(null)}
                disabled={isUploading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
