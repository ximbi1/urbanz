import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Shield, Sparkles, MapPin, Target, Trophy, Megaphone, Compass, Trees, Droplets, Activity, Flag, Plus, TrendingUp, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from './PullToRefreshIndicator';

interface ClansProps {
  onClose: () => void;
  isMobileFullPage?: boolean;
}

type ClanRole = 'leader' | 'officer' | 'member';

type ClanMissionType = 'park' | 'fountain' | 'district' | 'territories' | 'points';

interface ClanMembership {
  id: string;
  clan_id: string;
  role: ClanRole;
  contribution_points: number;
  clan: {
    id: string;
    name: string;
    description: string | null;
    banner_color: string | null;
    emblem_url: string | null;
    total_points: number;
    territories_controlled: number;
    created_at: string;
  };
}

interface ClanMemberSummary {
  id: string;
  username: string;
  avatar_url: string | null;
  color: string | null;
  contribution_points: number;
}

interface ClanMission {
  id: string;
  clan_id: string;
  mission_type: ClanMissionType;
  target_count: number;
  current_progress: number;
  reward_points: number;
  reward_shields: number;
  active: boolean;
  created_at: string;
}

interface ClanSummary {
  id: string;
  name: string;
  description: string | null;
  banner_color: string | null;
  total_points: number;
  territories_controlled: number;
  founder_id: string;
}

interface ClanEvent {
  id: string;
  created_at: string;
  event_type: string;
  payload: Record<string, any> | null;
  user?: {
    username: string;
    avatar_url: string | null;
  };
}

interface MapPoi {
  id: string;
  name: string;
  category: string;
}

const missionMeta: Record<ClanMissionType, { label: string; icon: ReactNode; accent: string; helper: string }> = {
  park: {
    label: 'Parques aliados',
    icon: <Trees className="w-4 h-4" />,
    accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
    helper: 'Captura territorios que incluyan parques del mapa OSM.',
  },
  fountain: {
    label: 'Ruta de hidratación',
    icon: <Droplets className="w-4 h-4" />,
    accent: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
    helper: 'Visita fuentes o puntos de agua mientras corres.',
  },
  district: {
    label: 'Distritos dominados',
    icon: <Flag className="w-4 h-4" />,
    accent: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
    helper: 'Conquista rutas completas dentro de barrios destacados.',
  },
  territories: {
    label: 'Territorios coordinados',
    icon: <Target className="w-4 h-4" />,
    accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    helper: 'Suma territorios conquistados o robados para el clan.',
  },
  points: {
    label: 'Puntos de influencia',
    icon: <TrendingUp className="w-4 h-4" />,
    accent: 'from-rose-500/20 to-rose-500/5 border-rose-500/30',
    helper: 'Aporta puntos totales ganados en tus carreras.',
  },
};

const Clans = ({ onClose, isMobileFullPage = false }: ClansProps) => {
  const { user } = useAuth();
  const [membership, setMembership] = useState<ClanMembership | null>(null);
  const [missions, setMissions] = useState<ClanMission[]>([]);
  const [topClans, setTopClans] = useState<ClanSummary[]>([]);
  const [clanFeed, setClanFeed] = useState<ClanEvent[]>([]);
  const [recommendedPois, setRecommendedPois] = useState<MapPoi[]>([]);
  const [clanMembers, setClanMembers] = useState<ClanMemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', color: '#2563eb' });
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadMembership(), loadTopClans()]);
    setLoading(false);
  };

  const loadMembership = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('clan_members')
        .select(`
          id,
          clan_id,
          role,
          contribution_points,
          clan:clans (id, name, description, banner_color, emblem_url, total_points, territories_controlled, created_at)
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.error('Error cargando membresía de clan:', error);
        }
        setMembership(null);
        setMissions([]);
        setClanFeed([]);
        setRecommendedPois([]);
        return;
      }

      let membershipData = data;
      if (membershipData && !membershipData.clan && membershipData.clan_id) {
        const { data: clanFallback } = await supabase
          .from('clans')
          .select('id, name, description, banner_color, emblem_url, total_points, territories_controlled, created_at')
          .eq('id', membershipData.clan_id)
          .maybeSingle();
        if (clanFallback) {
          membershipData = { ...membershipData, clan: clanFallback } as ClanMembership;
        }
      }

      setMembership(membershipData as ClanMembership | null);
      if (membershipData?.clan?.id) {
        await Promise.all([
          loadClanMissions(membershipData.clan.id),
          loadClanFeed(membershipData.clan.id),
          loadClanMembers(membershipData.clan.id),
        ]);
      } else {
        setMissions([]);
        setClanFeed([]);
        setRecommendedPois([]);
        setClanMembers([]);
      }
    } catch (error) {
      console.error('Error cargando clan:', error);
    }
  };

  const loadClanMissions = async (clanId: string) => {
    try {
      const { data, error } = await supabase
        .from('clan_missions')
        .select('*')
        .eq('clan_id', clanId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error cargando misiones de clan:', error);
        setMissions([]);
        return;
      }

      const parsed = (data || []).map((mission: any) => ({
        ...mission,
        mission_type: mission.mission_type as ClanMissionType,
      }));
      setMissions(parsed);

      const poiCategories = Array.from(
        new Set(
          parsed
            .map((mission) => mission.mission_type)
            .filter((type) => ['park', 'fountain', 'district'].includes(type))
        )
      );

      if (poiCategories.length) {
        await loadRecommendedPois(poiCategories as Array<'park' | 'fountain' | 'district'>);
      } else {
        setRecommendedPois([]);
      }
    } catch (error) {
      console.error('Error preparando misiones de clan:', error);
      setMissions([]);
    }
  };

  const loadClanFeed = async (clanId: string) => {
    try {
      const { data, error } = await supabase
        .from('clan_feed')
        .select(`
          id,
          created_at,
          event_type,
          payload,
          user:profiles (username, avatar_url)
        `)
        .eq('clan_id', clanId)
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) {
        console.error('Error cargando feed de clan:', error);
        setClanFeed([]);
        return;
      }

      setClanFeed(data || []);
    } catch (error) {
      console.error('Feed de clan no disponible:', error);
      setClanFeed([]);
    }
  };

  const loadClanMembers = async (clanId: string) => {
    try {
      const { data, error } = await supabase
        .from('clan_members')
        .select(`
          id,
          contribution_points,
          profiles:profiles!clan_members_user_id_fkey (username, avatar_url, color)
        `)
        .eq('clan_id', clanId)
        .order('contribution_points', { ascending: false })
        .limit(12);

      if (error) {
        console.error('Error cargando miembros del clan:', error);
        setClanMembers([]);
        return;
      }

      const formatted = (data || []).map((row) => ({
        id: row.id,
        username: row.profiles?.username || 'Miembro',
        avatar_url: row.profiles?.avatar_url || null,
        color: row.profiles?.color || null,
        contribution_points: row.contribution_points || 0,
      }));
      setClanMembers(formatted);
    } catch (error) {
      console.error('Miembros del clan no disponibles:', error);
      setClanMembers([]);
    }
  };

  const loadRecommendedPois = async (categories: Array<'park' | 'fountain' | 'district'>) => {
    try {
      const { data, error } = await supabase
        .from('map_pois')
        .select('id, name, category')
        .in('category', categories)
        .limit(12);

      if (error) {
        console.error('Error cargando POIs recomendados:', error);
        setRecommendedPois([]);
        return;
      }

      setRecommendedPois(data || []);
    } catch (error) {
      console.error('POIs no disponibles:', error);
      setRecommendedPois([]);
    }
  };

  const loadTopClans = async () => {
    try {
      const { data, error } = await supabase
        .from('clans')
        .select('id, name, description, banner_color, total_points, territories_controlled, founder_id')
        .order('total_points', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error cargando ranking de clanes:', error);
        setTopClans([]);
        return;
      }

      setTopClans(data || []);
    } catch (error) {
      console.error('Ranking de clanes no disponible:', error);
      setTopClans([]);
    }
  };

  const handleCreateClan = async () => {
    if (!user || !createForm.name.trim()) {
      toast.error('El clan necesita un nombre.');
      return;
    }
    if (membership) {
      toast.error('Ya perteneces a un clan. Abandónalo antes de fundar uno nuevo.');
      return;
    }
    setCreateLoading(true);
    let createdClanId: string | null = null;
    try {
      const { data: clan, error } = await supabase
        .from('clans')
        .insert({
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
          banner_color: createForm.color || '#2563eb',
          founder_id: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;
      createdClanId = clan.id;

      const { data: membershipRow, error: memberError } = await supabase
        .from('clan_members')
        .insert({ clan_id: clan.id, user_id: user.id, role: 'leader' })
        .select(`
          id,
          clan_id,
          role,
          contribution_points,
          clan:clans (id, name, description, banner_color, emblem_url, total_points, territories_controlled, created_at)
        `)
        .single();

      if (memberError || !membershipRow) throw memberError;
      setMembership(membershipRow as ClanMembership);

      await supabase
        .from('clan_feed')
        .insert({
          clan_id: clan.id,
          user_id: user.id,
          event_type: 'new_member',
          payload: { message: 'Fundó el clan' },
        });

      toast.success('Clan creado correctamente');
      setCreateForm({ name: '', description: '', color: '#2563eb' });
        await Promise.all([
          loadClanMissions(clan.id),
          loadClanFeed(clan.id),
          loadClanMembers(clan.id),
          loadTopClans(),
        ]);
    } catch (error) {
      console.error('No se pudo crear el clan:', error);
      if (createdClanId) {
        await supabase.from('clans').delete().eq('id', createdClanId);
      }
      toast.error('Error creando el clan');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinClan = async (clanId: string) => {
    if (!user) return;
    if (membership) {
      if (membership.clan?.id === clanId) {
        toast.info('Ya perteneces a este clan.');
      } else {
        toast.error('Debes salir de tu clan actual antes de unirte a otro.');
      }
      return;
    }
    setJoinLoading(clanId);
    try {
      const { data, error } = await supabase
        .from('clan_members')
        .insert({ clan_id: clanId, user_id: user.id, role: 'member' })
        .select(`
          id,
          clan_id,
          role,
          contribution_points,
          clan:clans (id, name, description, banner_color, emblem_url, total_points, territories_controlled, created_at)
        `)
        .single();

      if (error || !data) throw error;
      setMembership(data as ClanMembership);

      await supabase
        .from('clan_feed')
        .insert({
          clan_id: clanId,
          user_id: user.id,
          event_type: 'new_member',
          payload: { message: 'Se unió al clan' },
        });

      toast.success('¡Bienvenido al clan!');
        await Promise.all([
          loadClanMissions(clanId),
          loadClanFeed(clanId),
          loadClanMembers(clanId),
          loadTopClans(),
        ]);
    } catch (error) {
      console.error('Error uniéndose al clan:', error);
      if ((error as any)?.code === '23505') {
        toast.error('Ya formas parte de un clan.');
      } else {
        toast.error('No se pudo unir al clan');
      }
    } finally {
      setJoinLoading(null);
    }
  };

  const handleLeaveClan = async () => {
    if (!membership?.id) return;
    if (!confirm('¿Seguro que quieres abandonar tu clan actual?')) return;
    setLeaveLoading(true);
    try {
      await supabase
        .from('clan_members')
        .delete()
        .eq('id', membership.id);

      toast.success('Has abandonado el clan');
      setMembership(null);
      setMissions([]);
      setClanFeed([]);
      setRecommendedPois([]);
      setClanMembers([]);
      await loadTopClans();
    } catch (error) {
      console.error('No se pudo abandonar el clan:', error);
      toast.error('Error al abandonar el clan');
    } finally {
      setLeaveLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!membership?.clan?.id || !message.trim()) return;
    setMessageLoading(true);
    try {
      await supabase
        .from('clan_feed')
        .insert({
          clan_id: membership.clan.id,
          user_id: user?.id,
          event_type: 'custom_update',
          payload: { message: message.trim() },
        });

      setMessage('');
      toast.success('Mensaje enviado al clan');
      await loadClanFeed(membership.clan.id);
    } catch (error) {
      console.error('Error enviando mensaje de clan:', error);
      toast.error('No se pudo enviar el mensaje');
    } finally {
      setMessageLoading(false);
    }
  };

  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: async () => {
      setRefreshing(true);
      await loadAll();
      setRefreshing(false);
    },
    enabled: isMobileFullPage,
  });

  const recommendedByCategory = useMemo(() => {
    const map: Record<string, MapPoi[]> = {};
    recommendedPois.forEach((poi) => {
      if (!map[poi.category]) map[poi.category] = [];
      map[poi.category].push(poi);
    });
    return map;
  }, [recommendedPois]);

  const renderClanChat = () => (
    <Card className="p-4 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <div>
            <h3 className="font-semibold">Chat del clan</h3>
            <p className="text-xs text-muted-foreground">Organiza ofensivas y comparte novedades</p>
          </div>
        </div>
        <Badge variant="outline" className="uppercase tracking-widest">
          {membership?.role}
        </Badge>
      </div>
      <div className="flex-1 mt-3 space-y-3 overflow-y-auto max-h-72 pr-1">
        {clanFeed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay mensajes. Inicia la conversación.</p>
        ) : (
          clanFeed.map((event) => (
            <div key={event.id} className="rounded-lg border border-border/70 p-3 bg-card/60">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{event.user?.username || 'Sistema'}</span>
                <span>{new Date(event.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm">
                {event.event_type === 'mission_completed' && `🎯 ${event.payload?.missionName || 'Misión completada'} · +${event.payload?.rewardPoints || 0} pts`}
                {event.event_type === 'run_contribution' && `${event.user?.username || 'Un miembro'} aportó ${event.payload?.points || 0} pts y ${event.payload?.territories || 0} territorios.`}
                {event.event_type === 'custom_update' && event.payload?.message}
                {event.event_type === 'new_member' && `${event.user?.username || 'Nuevo miembro'} se ha unido.`}
                {event.event_type === 'territory_help' && `${event.user?.username || 'Miembro'} reforzó ${event.payload?.territoryName || 'un territorio'}.`}
                {!['mission_completed','run_contribution','custom_update','new_member','territory_help'].includes(event.event_type) && (event.payload?.message || 'Actividad reciente')}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 space-y-2">
        <Textarea
          placeholder="Comparte la próxima misión o felicita a tus compañeros"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSendMessage} disabled={messageLoading || !message.trim()}>
            {messageLoading ? 'Enviando...' : 'Enviar al clan'}
          </Button>
        </div>
      </div>
    </Card>
  );

  const renderMembersCard = () => (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <div>
          <h3 className="font-semibold">Miembros destacados</h3>
          <p className="text-xs text-muted-foreground">Contribuciones recientes</p>
        </div>
      </div>
      {clanMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Invita a tus amigos para formar la primera escuadra.</p>
      ) : (
        <div className="space-y-2">
          {clanMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2">
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center border"
                  style={{ borderColor: member.color || 'rgba(59,130,246,0.4)' }}
                >
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.username} className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold">{member.username.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">{member.username}</p>
                  <p className="text-xs text-muted-foreground">{member.contribution_points} pts</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  const renderMemberView = () => (
    <>
      {membership && (
        <Card className="p-5 bg-gradient-to-br from-primary/10 via-background to-background border border-primary/30">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase text-muted-foreground tracking-widest">Tu clan</p>
                <h2 className="text-2xl font-display font-bold" style={{ color: membership.clan?.banner_color || undefined }}>
                  {membership.clan?.name || 'Clan sin nombre'}
                </h2>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleLeaveClan}
                disabled={leaveLoading}
              >
                {leaveLoading ? 'Saliendo...' : 'Abandonar clan'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {membership.clan?.description || 'Coordina las conquistas urbanas con tu escuadrón para dominar la ciudad.'}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-card/60 border border-border/60">
                <p className="text-xs text-muted-foreground">Puntos totales</p>
                <p className="text-xl font-bold">{membership.clan?.total_points || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-card/60 border border-border/60">
                <p className="text-xs text-muted-foreground">Territorios controlados</p>
                <p className="text-xl font-bold">{membership.clan?.territories_controlled || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-card/60 border border-border/60">
                <p className="text-xs text-muted-foreground">Tu aporte</p>
                <p className="text-xl font-bold">{membership.contribution_points || 0} pts</p>
              </div>
              <div className="p-3 rounded-lg bg-card/60 border border-border/60">
                <p className="text-xs text-muted-foreground">Antigüedad</p>
                <p className="text-xl font-bold">
                  {membership.clan?.created_at ? new Date(membership.clan.created_at).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          {missions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Misiones colaborativas
                </h3>
                {isRefreshing && <span className="text-xs text-muted-foreground">Actualizando...</span>}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {missions.map((mission) => {
                  const meta = missionMeta[mission.mission_type];
                  const progressPercent = Math.min((mission.current_progress / mission.target_count) * 100, 100);
                  const remaining = Math.max(mission.target_count - mission.current_progress, 0);
                  return (
                    <Card
                      key={mission.id}
                      className={`p-4 border ${meta.accent} bg-gradient-to-br`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 font-semibold">
                          {meta.icon}
                          <span>{meta.label}</span>
                        </div>
                        <Badge variant={mission.active ? 'default' : 'outline'}>
                          {mission.active ? 'Activa' : 'Completada'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{meta.helper}</p>
                      <Progress value={progressPercent} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                        <span>{mission.current_progress}/{mission.target_count}</span>
                        <span>{remaining === 0 ? 'Objetivo alcanzado' : `Faltan ${remaining}`}</span>
                      </div>
                      {(mission.reward_points > 0 || mission.reward_shields > 0) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
                          <Trophy className="w-3 h-3" />
                          <span>
                            Recompensas: {mission.reward_points ? `+${mission.reward_points} pts` : ''}{mission.reward_points && mission.reward_shields ? ' · ' : ''}{mission.reward_shields ? `${mission.reward_shields} escudo` : ''}
                          </span>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {Object.keys(recommendedByCategory).length > 0 && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="font-semibold">POIs para misiones</h3>
                  <p className="text-sm text-muted-foreground">Lugares claves según tus retos actuales</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {Object.entries(recommendedByCategory).map(([category, pois]) => (
                  <div key={category} className="rounded-lg border border-dashed border-border/60 p-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{category}</p>
                    <ul className="space-y-1 text-sm">
                      {pois.slice(0, 4).map((poi) => (
                        <li key={poi.id} className="flex items-center gap-2">
                          <Compass className="w-3 h-3 text-primary" />
                          <span>{poi.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {renderClanChat()}
        </div>

        <div className="space-y-4">
          {renderMembersCard()}
        </div>
      </div>
    </>
  );

  const renderNonMemberView = () => (
    <>
      <Card className="p-4 border-dashed">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Únete o crea un clan</h3>
            <p className="text-sm text-muted-foreground">
              Coordina ataques, comparte objetivos y desbloquea misiones colaborativas usando los POIs reales de la ciudad.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <div>
            <h3 className="font-semibold">Clanes destacados</h3>
            <p className="text-xs text-muted-foreground">Elige uno para sumarte al instante</p>
          </div>
        </div>
        {topClans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay clanes creados.</p>
        ) : (
          <div className="space-y-2">
            {topClans.map((clan) => (
              <div
                key={clan.id}
                className="flex items-center justify-between rounded-lg border border-border/60 p-3"
              >
                <div>
                  <p className="font-semibold">{clan.name}</p>
                  <p className="text-xs text-muted-foreground">{clan.description || 'Clan activo en expansión urbana'}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">{clan.total_points} pts</p>
                  <p className="text-xs text-muted-foreground">{clan.territories_controlled} territorios</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={joinLoading === clan.id}
                  onClick={() => handleJoinClan(clan.id)}
                >
                  {joinLoading === clan.id ? 'Uniendo...' : 'Unirme'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Crear un clan
        </h3>
        <div className="space-y-2">
          <Input
            placeholder="Nombre del clan"
            value={createForm.name}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Textarea
            placeholder="Describe el estilo del clan y vuestra estrategia."
            value={createForm.description}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Color del banner</label>
            <input
              type="color"
              value={createForm.color}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, color: e.target.value }))}
              className="h-8 w-16 rounded border border-border bg-background"
            />
          </div>
          <Button onClick={handleCreateClan} disabled={createLoading}>
            {createLoading ? 'Creando...' : 'Fundar clan'}
          </Button>
        </div>
      </Card>
    </>
  );

  const renderContent = () => (
    <>
      <PullToRefreshIndicator
        isRefreshing={isRefreshing || refreshing}
        pullDistance={pullDistance}
        progress={progress}
      />

      {membership ? renderMemberView() : renderNonMemberView()}
    </>
  );
  if (isMobileFullPage) {
    return (
      <div className="w-full h-full flex flex-col bg-background">
        <div ref={containerRef} className="container mx-auto px-4 py-6 space-y-4 flex-1 overflow-y-auto pb-24 relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold glow-primary">Clanes</h2>
              <p className="text-xs text-muted-foreground">Coordina el dominio territorial</p>
            </div>
          </div>
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-2 md:p-4 animate-fade-in bg-background/80 backdrop-blur-sm z-50">
      <Card className="w-full max-w-3xl bg-card p-4 md:p-6 space-y-4 max-h-[90vh] flex flex-col border-glow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold glow-primary">Clanes</h2>
              <p className="text-xs text-muted-foreground">Misiones colaborativas y ranking</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
            {renderContent()}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
};

export default Clans;
