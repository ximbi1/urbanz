import { useState, useEffect } from 'react';
import { X, Trophy, Target, CheckCircle2, Clock, Award, Trees, Droplets, Map, Timer } from 'lucide-react';
import { ContentSkeleton } from './ui/content-skeleton';
import { EmptyState } from './ui/empty-state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from './PullToRefreshIndicator';

// Constantes para rotación de misiones
const ROTATION_DURATION_MS = 2 * 24 * 60 * 60 * 1000; // 2 días en ms
const TOTAL_ROTATION_SLOTS = 3; // 3 slots = 6 días de ciclo completo
const ROTATION_EPOCH = new Date('2025-01-01T00:00:00Z').getTime(); // Fecha base para calcular slots

// Calcula el slot actual basado en el tiempo
const getCurrentRotationSlot = () => {
  const elapsed = Date.now() - ROTATION_EPOCH;
  return Math.floor(elapsed / ROTATION_DURATION_MS) % TOTAL_ROTATION_SLOTS;
};

// Calcula el tiempo restante hasta la próxima rotación
const getTimeUntilNextRotation = () => {
  const elapsed = Date.now() - ROTATION_EPOCH;
  const currentCycleElapsed = elapsed % ROTATION_DURATION_MS;
  return ROTATION_DURATION_MS - currentCycleElapsed;
};

interface ChallengesProps {
  onClose: () => void;
  isMobileFullPage?: boolean;
}

interface Challenge {
  id: string;
  name: string;
  description: string;
  type: 'distance' | 'territories' | 'points';
  target_value: number;
  start_date: string;
  end_date: string;
  reward_points: number;
  icon: string;
  participation?: {
    current_progress: number;
    completed: boolean;
  };
  isUpcoming?: boolean;
}

interface Mission {
  id: string;
  title: string;
  description: string;
  mission_type: 'park' | 'fountain' | 'district';
  target_count: number;
  reward_points: number;
  reward_shields: number;
  rotation_slot: number;
  progress?: number;
  completed?: boolean;
}

interface MapTarget {
  id: string;
  challenge: {
    id: string;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    radius: number;
    reward_points: number;
  } | null;
}

const Challenges = ({ onClose, isMobileFullPage = false }: ChallengesProps) => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [mapTargets, setMapTargets] = useState<MapTarget[]>([]);
  const [mapTargetsLoading, setMapTargetsLoading] = useState(true);
  const [rotationCountdown, setRotationCountdown] = useState(getTimeUntilNextRotation());

  // Actualizar countdown cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setRotationCountdown(getTimeUntilNextRotation());
    }, 60000); // cada minuto
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      loadChallenges();
      loadMissions();
      loadMapTargets();
    }
  }, [user]);

  const loadChallenges = async () => {
    if (!user) return;

    setLoading(true);

    const nowIso = new Date().toISOString();

    // Cargar desafíos activos
    const { data: challengesData, error: challengesError } = await supabase
      .from('challenges')
      .select('*')
      .lte('start_date', nowIso)
      .gte('end_date', nowIso)
      .order('start_date', { ascending: true });

    if (challengesError) {
      console.error('Error cargando desafíos:', challengesError);
      toast.error('Error cargando desafíos');
      setLoading(false);
      return;
    }

    const { data: upcomingData, error: upcomingError } = await supabase
      .from('challenges')
      .select('*')
      .gt('start_date', nowIso)
      .order('start_date', { ascending: true })
      .limit(4);

    if (upcomingError) {
      console.error('Error cargando desafíos próximos:', upcomingError);
    }

    // Cargar participaciones del usuario
    const { data: participationsData, error: participationsError } = await supabase
      .from('challenge_participations')
      .select('*')
      .eq('user_id', user.id);

    if (participationsError) {
      console.error('Error cargando participaciones:', participationsError);
    }

    // Cargar todas las carreras del usuario para recalcular progreso
    const { data: runsData, error: runsError } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id);

    if (runsError) {
      console.error('Error cargando carreras:', runsError);
    }

    // Combinar datos y recalcular progreso basado en carreras reales
    const challengesWithProgress = (challengesData || []).map((challenge) => {
      const participation = participationsData?.find(
        (p) => p.challenge_id === challenge.id
      );

      // Calcular progreso real basado en las carreras en el período del desafío
      let actualProgress = 0;
      if (runsData && participation) {
        const runsInPeriod = runsData.filter(run => {
          const runDate = new Date(run.created_at);
          return runDate >= new Date(challenge.start_date) && 
                 runDate <= new Date(challenge.end_date);
        });

        if (challenge.type === 'distance') {
          actualProgress = runsInPeriod.reduce((sum, run) => sum + run.distance, 0);
        } else if (challenge.type === 'territories') {
          actualProgress = runsInPeriod.reduce((sum, run) => 
            sum + run.territories_conquered + run.territories_stolen, 0
          );
        } else if (challenge.type === 'points') {
          actualProgress = runsInPeriod.reduce((sum, run) => sum + run.points_gained, 0);
        }

        // Actualizar la participación si el progreso real es diferente
        if (participation && actualProgress !== participation.current_progress) {
          const isCompleted = actualProgress >= challenge.target_value;
          supabase
            .from('challenge_participations')
            .update({ 
              current_progress: actualProgress,
              completed: isCompleted,
              completed_at: isCompleted && !participation.completed ? new Date().toISOString() : participation.completed_at
            })
            .eq('id', participation.id)
            .then(() => console.log('Progreso actualizado'));
        }
      }

      return {
        ...challenge,
        type: challenge.type as 'distance' | 'territories' | 'points',
        participation: participation
          ? {
              current_progress: actualProgress || participation.current_progress,
              completed: actualProgress >= challenge.target_value || participation.completed,
            }
          : undefined,
      };
    });

    const upcomingChallenges: Challenge[] = (upcomingData || []).map((challenge) => ({
      ...challenge,
      type: challenge.type as 'distance' | 'territories' | 'points',
      isUpcoming: true,
    }));

    setChallenges([...challengesWithProgress, ...upcomingChallenges]);
    setLoading(false);
  };

  const loadMissions = async () => {
    if (!user) return;
    setMissionsLoading(true);
    
    // Obtener el slot de rotación actual
    const currentSlot = getCurrentRotationSlot();

    const { data: missionsData, error: missionsError } = await supabase
      .from('missions')
      .select('*')
      .eq('active', true)
      .eq('rotation_slot', currentSlot)
      .order('mission_type', { ascending: true });

    if (missionsError) {
      console.error('Error cargando misiones:', missionsError);
      toast.error('Error cargando misiones');
      setMissionsLoading(false);
      return;
    }

    const { data: missionsProgress } = await supabase
      .from('mission_progress')
      .select('*')
      .eq('user_id', user.id);

    const combined = (missionsData || []).map((mission) => {
      const progressRow = missionsProgress?.find((row) => row.mission_id === mission.id);
      return {
        ...mission,
        mission_type: mission.mission_type as Mission['mission_type'],
        rotation_slot: mission.rotation_slot || 0,
        progress: progressRow?.progress || 0,
        completed: progressRow?.completed || false,
      } as Mission;
    });

    setMissions(combined);
    setMissionsLoading(false);
  };

  const joinChallenge = async (challengeId: string) => {
    if (!user) return;

    const { error } = await supabase.from('challenge_participations').insert({
      challenge_id: challengeId,
      user_id: user.id,
      current_progress: 0,
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('Ya estás participando en este desafío');
      } else {
        toast.error('Error uniéndose al desafío');
      }
      console.error(error);
    } else {
      toast.success('¡Te has unido al desafío!');
      loadChallenges();
    }
  };

  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([loadChallenges(), loadMissions(), loadMapTargets()]);
    },
    enabled: isMobileFullPage,
  });

  const formatValue = (type: string, value: number) => {
    if (type === 'distance') {
      return `${(value / 1000).toFixed(1)} km`;
    }
    return value.toString();
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      distance: 'Distancia',
      territories: 'Territorios',
      points: 'Puntos',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const missionIconMap: Record<Mission['mission_type'], any> = {
    park: Trees,
    fountain: Droplets,
    district: Map,
  };

  const getMissionLabel = (type: Mission['mission_type']) => {
    const labels = {
      park: 'Parques',
      fountain: 'Fuentes',
      district: 'Barrios',
    };
    return labels[type];
  };

  const loadMapTargets = async () => {
    if (!user) return;
    setMapTargetsLoading(true);
    const { data, error } = await supabase
      .from('map_challenge_targets')
      .select(`
        id,
        challenge:map_challenges (id, name, description, latitude, longitude, radius, reward_points)
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error cargando objetivos del mapa:', error);
      toast.error('No se pudieron cargar tus objetivos del mapa');
      setMapTargets([]);
    } else {
      setMapTargets((data || []) as MapTarget[]);
    }
    setMapTargetsLoading(false);
  };

  const removeMapTarget = async (targetId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('map_challenge_targets')
        .delete()
        .eq('id', targetId)
        .eq('user_id', user.id);
      if (error) throw error;
      setMapTargets((prev) => prev.filter((target) => target.id !== targetId));
      toast.success('Objetivo eliminado');
    } catch (error) {
      console.error('Error eliminando objetivo de mapa:', error);
      toast.error('No se pudo eliminar el objetivo');
    }
  };

  // Formatear el countdown
  const formatCountdown = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const renderMissionSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-display font-bold">Misiones dinámicas</h3>
        </div>
        <Badge variant="outline" className="flex items-center gap-1 text-xs">
          <Timer className="w-3 h-3" />
          Rota en {formatCountdown(rotationCountdown)}
        </Badge>
      </div>
      {missionsLoading ? (
        <ContentSkeleton type="challenges" count={2} />
      ) : missions.length === 0 ? (
        <EmptyState 
          type="challenges" 
          className="py-6"
          title="Sin misiones activas"
          description="Vuelve pronto para nuevas misiones"
        />
      ) : (
        <div className="space-y-3">
          {missions.map((mission) => {
            const Icon = missionIconMap[mission.mission_type];
            const progressValue = Math.min(mission.progress || 0, mission.target_count);
            const percent = Math.min(100, (progressValue / mission.target_count) * 100);
            return (
              <Card key={mission.id} className="p-4 bg-card/80 border-border">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">{getMissionLabel(mission.mission_type)}</p>
                        <h4 className="text-base font-semibold">{mission.title}</h4>
                      </div>
                      {mission.completed && (
                        <span className="text-xs font-semibold text-emerald-500">Completada</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{mission.description}</p>
                    <div className="mt-3 space-y-1">
                      <Progress value={percent} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progreso: {progressValue}/{mission.target_count}</span>
                        <span>
                          {mission.reward_points ? `+${mission.reward_points} pts` : ''}
                          {mission.reward_points && mission.reward_shields ? ' · ' : ''}
                          {mission.reward_shields ? `+${mission.reward_shields} escudo` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderMapTargetsSection = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Map className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-display font-bold">Objetivos seleccionados en el mapa</h3>
      </div>
      {mapTargetsLoading ? (
        <Card className="p-4 bg-muted/30 border-border text-sm text-muted-foreground">
          Cargando objetivos del mapa...
        </Card>
      ) : mapTargets.length === 0 ? (
        <Card className="p-4 bg-muted/20 border-dashed border-border text-sm text-muted-foreground">
          Marca un reto del mapa desde la vista principal para verlo aquí.
        </Card>
      ) : (
        <div className="space-y-3">
          {mapTargets.map((target) => (
            <Card key={target.id} className="p-4 bg-card/80 border-border flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{target.challenge?.name || 'Objetivo del mapa'}</p>
                <p className="text-sm text-muted-foreground">
                  {target.challenge?.description || 'Explora el área indicada para completarlo.'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Lat: {target.challenge?.latitude?.toFixed(3)} · Lng: {target.challenge?.longitude?.toFixed(3)}
                </p>
                <p className="text-xs text-primary mt-1">Recompensa: +{target.challenge?.reward_points || 0} pts</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => removeMapTarget(target.id)}>
                Quitar
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const renderChallengeCard = (challenge: Challenge, variant: 'mobile' | 'desktop') => {
    const isUpcoming = Boolean(challenge.isUpcoming);
    const daysRemaining = getDaysRemaining(challenge.end_date);
    const isExpired = !isUpcoming && daysRemaining < 0;
    const startInDays = Math.max(
      Math.ceil((new Date(challenge.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      0
    );
    const progress = !isUpcoming && challenge.participation
      ? Math.min((challenge.participation.current_progress / challenge.target_value) * 100, 100)
      : 0;
    const isCompleted = !isUpcoming && (challenge.participation?.completed || false);
    const timelineLabel = isUpcoming
      ? `Comienza en ${startInDays} día${startInDays === 1 ? '' : 's'}`
      : daysRemaining > 0
      ? `${daysRemaining} día${daysRemaining === 1 ? '' : 's'} restantes`
      : 'Último día';
    const showJoinButton = !isUpcoming && !challenge.participation && !isExpired;

    const baseClasses = variant === 'mobile' ? 'p-4 md:p-5' : 'p-4 md:p-5';
    const stateClasses = isUpcoming
      ? 'border-dashed border-primary/40 bg-card'
      : isCompleted
      ? 'border-success/60 bg-success/5'
      : isExpired
      ? 'border-muted/40 opacity-70'
      : 'border-primary/30 hover:border-primary/50';

    return (
      <Card key={challenge.id} className={`${baseClasses} border-2 transition-all ${stateClasses}`}>
        <div className="flex items-start gap-4">
          <div className="text-3xl md:text-4xl">{challenge.icon}</div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg md:text-xl font-display font-bold flex items-center gap-2">
                {challenge.name}
                {isCompleted && <CheckCircle2 className="w-5 h-5 text-success" />}
              </h3>
              {isUpcoming && <Badge variant="outline">Próximo</Badge>}
              {!isUpcoming && challenge.participation && (
                <Badge variant="secondary">Participando</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{challenge.description}</p>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{timelineLabel}</span>
              </div>
              <div className="flex items-center gap-1 text-primary font-semibold">
                <Award className="w-4 h-4" />
                <span>+{challenge.reward_points} pts</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{getTypeLabel(challenge.type)}:</span>
                <span className="font-semibold">
                  {formatValue(challenge.type, isUpcoming ? 0 : challenge.participation?.current_progress || 0)} /{' '}
                  {formatValue(challenge.type, challenge.target_value)}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {showJoinButton ? (
              <Button
                onClick={() => joinChallenge(challenge.id)}
                variant="secondary"
                size="sm"
                className="w-full md:w-auto"
              >
                Unirse al desafío
              </Button>
            ) : (
              isUpcoming && (
                <Button disabled variant="outline" size="sm" className="w-full md:w-auto">
                  Disponible pronto
                </Button>
              )
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (isMobileFullPage) {
    return (
      <div className="w-full h-full overflow-y-auto">
        <div ref={containerRef} className="container mx-auto px-4 py-6 space-y-6 relative">
          <PullToRefreshIndicator
            isRefreshing={isRefreshing}
            pullDistance={pullDistance}
            progress={progress}
          />
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Target className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold glow-primary">
              Misiones y desafíos
            </h1>
          </div>

          <p className="text-muted-foreground">
            Completa misiones dinámicas y desafíos semanales para ganar recompensas extra
          </p>

          <div className="pt-4 border-t border-border">
            {renderMissionSection()}
            <div className="mt-6">
              {renderMapTargetsSection()}
            </div>
          </div>

          {/* Challenges content */}
          {loading ? (
            <ContentSkeleton type="challenges" count={3} />
          ) : challenges.length === 0 ? (
            <EmptyState type="challenges" />
          ) : (
            <div className="space-y-4">
              {challenges.map((challenge) => renderChallengeCard(challenge, 'mobile'))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4 animate-fade-in">
      <Card className="w-full max-w-2xl bg-card border-glow p-4 md:p-6 space-y-4 md:space-y-6 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold glow-primary">
              Misiones y desafíos
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className={isMobileFullPage ? 'hidden' : ''}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Descripción */}
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>Completa misiones dinámicas y desafíos semanales para ganar recompensas extra.</p>
          <div className="pt-2 border-t border-border">
            {renderMissionSection()}
            <div className="mt-6">
              {renderMapTargetsSection()}
            </div>
          </div>
        </div>

        {/* Lista de desafíos */}
        {loading ? (
          <ContentSkeleton type="challenges" count={3} />
        ) : challenges.length === 0 ? (
          <EmptyState type="challenges" />
        ) : (
          <div className="space-y-4">
            {challenges.map((challenge) => renderChallengeCard(challenge, 'desktop'))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Challenges;
