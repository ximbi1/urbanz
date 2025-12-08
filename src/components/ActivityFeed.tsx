import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { X, MapPin, Zap, TrendingUp, Activity, Clock, PlayCircle, Trophy, Handshake, ThumbsUp, Sword, Sparkles, Megaphone, Users } from 'lucide-react';
import { ContentSkeleton } from './ui/content-skeleton';
import { EmptyState } from './ui/empty-state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from './PullToRefreshIndicator';
import { Coordinate } from '@/types/territory';
import { RunReplayModal } from './RunReplayModal';
import { toast } from 'sonner';

interface ActivityFeedProps {
  onClose: () => void;
  isMobileFullPage?: boolean;
}

interface FriendActivity {
  id: string;
  created_at: string;
  distance: number;
  duration: number;
  avg_pace: number;
  path: Coordinate[];
  territories_conquered: number;
  territories_stolen: number;
  points_gained: number;
  likes_count: number;
  liked_by_user: boolean;
  user: {
    username: string;
    avatar_url: string | null;
    color: string;
  };
}

interface ClanEvent {
  id: string;
  created_at: string;
  event_type: string;
  payload: any;
  clan: {
    id: string;
    name: string;
    banner_color: string | null;
  };
  user?: {
    username: string;
    avatar_url: string | null;
  };
}

type FeedItem =
  | { type: 'run'; data: FriendActivity }
  | { type: 'clan'; data: ClanEvent };

const ActivityFeed = ({ onClose, isMobileFullPage = false }: ActivityFeedProps) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<FriendActivity[]>([]);
  const [clanEvents, setClanEvents] = useState<ClanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayPath, setReplayPath] = useState<Coordinate[] | null>(null);
  const [replayTitle, setReplayTitle] = useState<string>('Replay de carrera');

  useEffect(() => {
    if (user) {
      loadActivities();
      loadClanEvents();
      const unsubscribeRuns = subscribeToActivities();
      const unsubscribeClan = subscribeToClanFeed();
      return () => {
        unsubscribeRuns?.();
        unsubscribeClan?.();
      };
    }
  }, [user]);

  const loadActivities = async () => {
    if (!user) return;

    setLoading(true);

    try {
      // Calcular fecha de hace 7 días
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Obtener IDs de amigos (bidireccional)
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      const friendIds = new Set<string>();
      if (friendships) {
        friendships.forEach(f => {
          if (f.user_id !== user.id) friendIds.add(f.user_id);
          if (f.friend_id !== user.id) friendIds.add(f.friend_id);
        });
      }

      // Obtener usuarios cercanos basándose en territorios
      const { data: userTerritories } = await supabase
        .from('territories')
        .select('coordinates')
        .eq('user_id', user.id)
        .eq('conquered', true)
        .limit(10);

      const nearbyUserIds = new Set<string>();
      
      if (userTerritories && userTerritories.length > 0) {
        // Obtener todos los territorios de otros usuarios
        const { data: otherTerritories } = await supabase
          .from('territories')
          .select('user_id, coordinates')
          .neq('user_id', user.id)
          .eq('conquered', true)
          .limit(200);

        if (otherTerritories) {
          // Calcular distancia entre territorios para encontrar usuarios cercanos
          otherTerritories.forEach(territory => {
            const coords = territory.coordinates as any;
            // Soportar distintos formatos de coordenadas (p.ej. GeoJSON Polygons)
            const firstPoint = Array.isArray(coords)
              ? (Array.isArray(coords[0]) ? coords[0] : null)
              : null;

            if (firstPoint && firstPoint.length >= 2) {
              const [lng, lat] = firstPoint;
              
              // Verificar si está cerca de algún territorio del usuario
              const isNearby = userTerritories.some(userTerritory => {
                const userCoords = userTerritory.coordinates as any;
                const userFirstPoint = Array.isArray(userCoords)
                  ? (Array.isArray(userCoords[0]) ? userCoords[0] : null)
                  : null;

                if (userFirstPoint && userFirstPoint.length >= 2) {
                  const [userLng, userLat] = userFirstPoint;
                  // Aproximadamente 5km de radio (0.045 grados ≈ 5km)
                  const distance = Math.sqrt(
                    Math.pow(lat - userLat, 2) + Math.pow(lng - userLng, 2)
                  );
                  return distance < 0.045;
                }
                return false;
              });

              if (isNearby) {
                nearbyUserIds.add(territory.user_id);
              }
            }
          });
        }
      }

      // Combinar amigos, usuarios cercanos y el propio usuario
      const allUserIds = new Set([...friendIds, ...nearbyUserIds, user.id]);
      const allUserIdsArray = Array.from(allUserIds);
      console.log('ActivityFeed allUserIds (debug)', allUserIdsArray);

      // Cargar carreras de los últimos 7 días solo de amigos/usuarios cercanos/propio usuario
      const { data: runs, error: runsError } = await supabase
        .from('runs')
        .select(`
          id,
          created_at,
          distance,
          duration,
          avg_pace,
          path,
          territories_conquered,
          territories_stolen,
          points_gained,
          user_id
        `)
        .in('user_id', allUserIdsArray)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      // Obtener perfiles de los usuarios
      const userIds = runs?.map(r => r.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, color')
        .in('id', userIds);

      console.log('ActivityFeed runs result', { error: runsError, count: runs?.length, sample: runs?.[0] });

      if (runsError) {
        console.error('Error cargando actividades:', runsError);
        setActivities([]);
        setLoading(false);
        return;
      }

      // Crear mapa de perfiles
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      let reactionMap = new Map<string, { count: number; liked: boolean }>();
      if (runs && runs.length > 0) {
        const runIds = runs.map((run) => run.id);
        const { data: reactions, error: reactionsError } = await supabase
          .from('run_reactions')
          .select('run_id, user_id')
          .in('run_id', runIds);

        if (reactionsError) {
          console.error('Error cargando reacciones de carreras:', reactionsError);
        } else {
          reactions?.forEach((reaction) => {
            const existing = reactionMap.get(reaction.run_id) || { count: 0, liked: false };
            existing.count += 1;
            if (reaction.user_id === user.id) {
              existing.liked = true;
            }
            reactionMap.set(reaction.run_id, existing);
          });
        }
      }

      const formattedActivities: FriendActivity[] = (runs || []).map((run: any) => {
        const reactionInfo = reactionMap.get(run.id) || { count: 0, liked: false };
        const profile = profilesMap.get(run.user_id);
        return {
          id: run.id,
          created_at: run.created_at,
          distance: run.distance,
          duration: run.duration,
          avg_pace: run.avg_pace,
          path: run.path,
          territories_conquered: run.territories_conquered,
          territories_stolen: run.territories_stolen,
          points_gained: run.points_gained,
          likes_count: reactionInfo.count,
          liked_by_user: reactionInfo.liked,
          user: {
            username: profile?.username || 'Usuario',
            avatar_url: profile?.avatar_url || null,
            color: profile?.color || '#8b5cf6',
          },
        };
      });

      setActivities(formattedActivities);
    } catch (error) {
      console.error('Error cargando actividades:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const loadClanEvents = async () => {
    if (!user) return;
    try {
      const { data: memberships } = await supabase
        .from('clan_members')
        .select('clan_id')
        .eq('user_id', user.id);

      const clanIds = memberships?.map((m) => m.clan_id) || [];
      if (!clanIds.length) {
        setClanEvents([]);
        return;
      }

      const { data, error } = await supabase
        .from('clan_feed')
        .select(`
          id,
          created_at,
          event_type,
          payload,
          clan:clans (id, name, banner_color),
          user:profiles (username, avatar_url)
        `)
        .in('clan_id', clanIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error cargando eventos de clan:', error);
        setClanEvents([]);
        return;
      }

      const formatted: ClanEvent[] = (data || []).map((row: any) => ({
        id: row.id,
        created_at: row.created_at,
        event_type: row.event_type,
        payload: row.payload,
        clan: {
          id: row.clan?.id,
          name: row.clan?.name || 'Clan',
          banner_color: row.clan?.banner_color,
        },
        user: row.user
          ? {
              username: row.user.username,
              avatar_url: row.user.avatar_url,
            }
          : undefined,
      }));

      setClanEvents(formatted);
    } catch (error) {
      console.error('Error cargando eventos de clan:', error);
      setClanEvents([]);
    }
  };

  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([loadActivities(), loadClanEvents()]);
    },
    enabled: isMobileFullPage,
  });

  const subscribeToActivities = () => {
    const channel = supabase
      .channel('friend-activities')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'runs',
        },
        () => {
          loadActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToClanFeed = () => {
    const channel = supabase
      .channel('clan-feed-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'clan_feed',
        },
        () => {
          loadClanEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hrs > 0) {
      return `${hrs}h ${remainingMins}m`;
    }
    return `${mins}m`;
  };

  const formatPace = (pace: number) => {
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')} min/km`;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    }
    if (diffHours > 0) {
      return `hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    }
    if (diffMins > 0) {
      return `hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    }
    return 'ahora mismo';
  };

  const getActivityMessage = (activity: FriendActivity) => {
    const snippets: string[] = [];
    if (activity.territories_stolen > 0) {
      snippets.push(`robó ${activity.territories_stolen} territorio${activity.territories_stolen > 1 ? 's' : ''}`);
    }
    if (activity.territories_conquered > 0) {
      snippets.push(`conquistó ${activity.territories_conquered} territorio${activity.territories_conquered > 1 ? 's' : ''}`);
    }
    if (activity.points_gained > 0) {
      snippets.push(`sumó ${activity.points_gained} pts`);
    }
    return snippets.length ? snippets.join(' · ') : 'salió a patrullar la ciudad';
  };

  const toggleRunCheer = async (runId: string, liked: boolean, username: string) => {
    if (!user) return;
    try {
      if (liked) {
        await supabase
          .from('run_reactions')
          .delete()
          .eq('run_id', runId)
          .eq('user_id', user.id);
        toast.info(`Quitaste tu felicitación a ${username}`);
      } else {
        await supabase
          .from('run_reactions')
          .insert({ run_id: runId, user_id: user.id, reaction: 'cheer' })
          .single();
        toast.success(`Felicitaste a ${username}`);
      }

      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === runId
            ? {
                ...activity,
                likes_count: Math.max(activity.likes_count + (liked ? -1 : 1), 0),
                liked_by_user: !liked,
              }
            : activity
        )
      );
    } catch (error) {
      console.error('No se pudo actualizar la reacción de la carrera:', error);
      toast.error('Error al guardar tu felicitación');
    }
  };

  const handleRevenge = (username: string) => {
    toast.info(`Marcaste a ${username} para contraatacar pronto`);
  };

  const MiniMapPreview = ({ path }: { path: Coordinate[] }) => {
    if (!path || path.length < 2) return null;
    const lats = path.map(p => p.lat);
    const lngs = path.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLng = maxLng - minLng || 0.0001;
    const spanLat = maxLat - minLat || 0.0001;

    const points = path.map(p => {
      const x = ((p.lng - minLng) / spanLng) * 100;
      const y = 60 - ((p.lat - minLat) / spanLat) * 60;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    return (
      <svg viewBox="0 0 100 60" className="w-full h-20 rounded-lg bg-muted/40">
        <defs>
          <linearGradient id="feed-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <pattern id="feed-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#0f172a" opacity="0.6" />
            <path d="M10 0H0V10" fill="none" stroke="#1e293b" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100" height="60" rx="8" fill="url(#feed-grid)" />
        <path d={`M ${points.join(' L ')}`} fill="none" stroke="url(#feed-gradient)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  };

  const renderRunCard = (activity: FriendActivity) => {
    const badges: string[] = [];
    if (activity.territories_stolen > 0) badges.push('🔥 Robo');
    if (activity.territories_conquered > 2) badges.push('🏅 Dominio');
    if (activity.points_gained > 200) badges.push('💎 Alta puntuación');

    return (
      <Card key={`run-${activity.id}`} className="p-4 bg-card/90 border-border space-y-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 border-2" style={{ borderColor: activity.user.color }}>
            <AvatarImage src={activity.user.avatar_url || undefined} />
            <AvatarFallback>{activity.user.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{activity.user.username}</p>
                <p className="text-xs text-muted-foreground">{getTimeAgo(activity.created_at)}</p>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {badges.map(badge => (
                  <span key={badge} className="px-2 py-0.5 text-[11px] rounded-full bg-primary/10 text-primary font-semibold">
                    {badge}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {getActivityMessage(activity)} • {formatDistance(activity.distance)} • {formatPace(activity.avg_pace)} • {formatDuration(activity.duration)}
            </p>
          </div>
        </div>
        <MiniMapPreview path={activity.path} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{activity.territories_conquered} conquistados</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span>{activity.points_gained} pts</span>
          </div>
          {activity.territories_stolen > 0 && (
            <div className="flex items-center gap-1 text-amber-500">
              <Sword className="w-4 h-4" />
              <span>{activity.territories_stolen} robados</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={activity.liked_by_user ? 'default' : 'outline'}
            onClick={() => toggleRunCheer(activity.id, activity.liked_by_user, activity.user.username)}
          >
            <ThumbsUp className="w-4 h-4 mr-1" />
            {activity.liked_by_user ? 'Felicitado' : 'Felicitar'}
            <span className="ml-2 text-xs text-muted-foreground">{activity.likes_count}</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleRevenge(activity.user.username)}>
            <Sword className="w-4 h-4 mr-1" /> Vengar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setReplayPath(activity.path);
              setReplayTitle(`Carrera de ${activity.user.username}`);
            }}
          >
            <PlayCircle className="w-4 h-4 mr-1" /> Ver replay
          </Button>
        </div>
      </Card>
    );
  };

  const renderClanEventCard = (event: ClanEvent) => {
    const icon = (() => {
      switch (event.event_type) {
        case 'mission_completed':
          return <Sparkles className="w-4 h-4" />;
        case 'territory_help':
          return <Handshake className="w-4 h-4" />;
        case 'run_contribution':
          return <TrendingUp className="w-4 h-4" />;
        case 'custom_update':
          return <Megaphone className="w-4 h-4" />;
        case 'new_member':
          return <Users className="w-4 h-4" />;
        default:
          return <Activity className="w-4 h-4" />;
      }
    })();

    const message = (() => {
      switch (event.event_type) {
        case 'mission_completed':
          return `${event.user?.username || 'Un miembro'} completó la misión ${event.payload?.missionName || ''}`;
        case 'territory_help':
          return `${event.user?.username || 'Un miembro'} apoyó en ${event.payload?.territoryName || 'un territorio'}`;
        case 'run_contribution':
          return `${event.user?.username || 'Un miembro'} aportó ${event.payload?.points || 0} pts y ${event.payload?.territories || 0} territorios al clan`;
        case 'custom_update':
          return event.payload?.message || 'Actualización del clan';
        case 'new_member':
          return `${event.user?.username || 'Nuevo miembro'} se unió al clan`;
        default:
          return event.payload?.message || 'Actividad reciente en tu clan';
      }
    })();

    return (
      <Card key={`clan-${event.id}`} className="p-4 border border-primary/20 bg-primary/5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: event.clan.banner_color || 'rgba(59,130,246,0.15)' }}>
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{event.clan.name}</p>
                <p className="text-xs text-muted-foreground">{getTimeAgo(event.created_at)}</p>
              </div>
              <div className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase">
                {event.event_type.replace('_', ' ')}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              {icon} <span>{message}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => toast.success('Mostrando territorio aliado')}>
            <MapPin className="w-4 h-4 mr-1" /> Ver detalle
          </Button>
          <Button size="sm" variant="ghost" onClick={() => toast.info('Pronto podrás coordinar ataques desde aquí')}>
            <Zap className="w-4 h-4 mr-1" /> Coordinar
          </Button>
        </div>
      </Card>
    );
  };

  const combinedFeed: FeedItem[] = useMemo(() => {
    const runItems = activities.map((activity) => ({ type: 'run', data: activity }) as FeedItem);
    const clanItems = clanEvents
      .filter((event) => event.event_type !== 'custom_update')
      .map((event) => ({ type: 'clan', data: event }) as FeedItem);
    return [...runItems, ...clanItems].sort(
      (a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime()
    );
  }, [activities, clanEvents]);

  const renderActivities = () => (
    <>
      {loading && combinedFeed.length === 0 ? (
        <ContentSkeleton type="runs" count={4} />
      ) : combinedFeed.length === 0 ? (
        <EmptyState 
          type="friends"
          title="Sin actividad reciente"
          description="Las carreras de amigos y eventos de tu clan aparecerán aquí"
        />
      ) : (
        <div className="space-y-3">
          {combinedFeed.map(item =>
            item.type === 'run' ? renderRunCard(item.data) : renderClanEventCard(item.data)
          )}
        </div>
      )}
    </>
  );

  if (isMobileFullPage) {
    return (
      <>
        <div className="w-full h-full flex flex-col bg-background">
          <div ref={containerRef} className="container mx-auto px-4 py-6 space-y-4 flex-1 overflow-y-auto pb-24 relative">
            <PullToRefreshIndicator
              isRefreshing={isRefreshing}
              pullDistance={pullDistance}
              progress={progress}
            />
            
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-bold glow-primary">
                  Feed de Actividad
                </h2>
                <p className="text-xs text-muted-foreground">
                  Amigos y corredores cercanos
                </p>
              </div>
            </div>

            {/* Activities List */}
            {renderActivities()}
          </div>
        </div>
        {replayPath && (
          <RunReplayModal
            path={replayPath}
            title={replayTitle}
            onClose={() => setReplayPath(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center p-2 md:p-4 animate-fade-in bg-background/80 backdrop-blur-sm z-50">
        <Card className="w-full max-w-2xl bg-card p-4 md:p-6 space-y-4 max-h-[90vh] flex flex-col border-glow">
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold glow-primary">
                    Feed de Actividad
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Amigos y corredores cercanos
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Activities List */}
            <ScrollArea className="flex-1 pr-4">
              {renderActivities()}
            </ScrollArea>
          </div>
        </Card>
      </div>
      {replayPath && (
        <RunReplayModal
          path={replayPath}
          title={replayTitle}
          onClose={() => setReplayPath(null)}
        />
      )}
    </>
  );
};

export default ActivityFeed;
