import { useState, useEffect } from 'react';
import { X, UserPlus, Check, XIcon, Users, Search, Swords, Loader2, Shield, Users2 } from 'lucide-react';
import { ContentSkeleton } from './ui/content-skeleton';
import { EmptyState } from './ui/empty-state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from './PullToRefreshIndicator';
import { Duel, DuelType } from '@/types/territory';
import { Lobbies } from './Lobbies';

interface FriendsProps {
  onClose: () => void;
  isMobileFullPage?: boolean;
  onViewUserProfile?: (userId: string) => void;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  friend_profile?: {
    username: string;
    avatar_url: string | null;
    color: string;
    total_points?: number;
    total_territories?: number;
  };
}

const Friends = ({ onClose, isMobileFullPage = false, onViewUserProfile }: FriendsProps) => {
  const { user } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState<'friends' | 'lobbies'>('friends');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [duelsLoading, setDuelsLoading] = useState(false);
  const [creatingDuel, setCreatingDuel] = useState(false);
  const [showDuelForm, setShowDuelForm] = useState(false);
  const [duelFriend, setDuelFriend] = useState('');
  const [currentDuelType, setCurrentDuelType] = useState<DuelType>('distance');
  const [duelTarget, setDuelTarget] = useState('20000');
  const duelTypeLabels: Record<DuelType, string> = {
    distance: 'Distancia',
    points: 'Puntos',
    territories: 'Territorios',
    arena: 'Arena',
  };
  const [friendClans, setFriendClans] = useState<Record<string, { id: string; name: string }>>({});

  const { containerRef, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: async () => {
      await loadFriends();
      await loadPendingRequests();
      await loadDuels();
    },
    enabled: isMobileFullPage,
  });

  useEffect(() => {
    if (user) {
      loadFriends();
      loadPendingRequests();
      loadDuels();
    }
  }, [user]);

  const loadFriends = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        friend_profile:profiles!friendships_friend_id_fkey (username, avatar_url, color, total_points, total_territories)
      `)
      .eq('user_id', user.id)
      .eq('status', 'accepted');

    if (error) {
      console.error('Error cargando amigos:', error);
      return;
    }

    const normalized = (data || []).map(f => ({ ...f, status: f.status as 'pending' | 'accepted' | 'rejected' }));
    setFriends(normalized);
    const ids = normalized.map((f) => f.friend_id);
    await loadFriendClans(ids);
  };

  const loadFriendClans = async (friendIds: string[]) => {
    if (!friendIds.length) {
      setFriendClans({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clan_members')
        .select('user_id, clan:clans (id, name)')
        .in('user_id', friendIds);

      if (error) throw error;

      const map: Record<string, { id: string; name: string }> = {};
      (data || []).forEach((row: any) => {
        if (row.clan) {
          map[row.user_id] = { id: row.clan.id, name: row.clan.name };
        }
      });
      setFriendClans(map);
    } catch (error) {
      console.error('No se pudo cargar el clan de los amigos:', error);
    }
  };

  const loadPendingRequests = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        friend_profile:profiles!friendships_user_id_fkey (username, avatar_url, color)
      `)
      .eq('friend_id', user.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error cargando solicitudes:', error);
      return;
    }

    setPendingRequests((data || []).map(f => ({ ...f, status: f.status as 'pending' | 'accepted' | 'rejected' })));
  };

  const loadDuels = async () => {
    if (!user) return;
    setDuelsLoading(true);
    try {
      // Solo cargar duelos activos/pendientes, o completados en las últimas 24h
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('duels')
        .select('*')
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .or(`status.neq.completed,created_at.gt.${oneDayAgo}`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Filtrar en cliente: mostrar activos/pendientes, o completados hace menos de 24h
      const filteredDuels = (data || []).filter((duel) => {
        if (duel.status !== 'completed') return true;
        const completedRecently = new Date(duel.end_at).getTime() > Date.now() - 24 * 60 * 60 * 1000;
        return completedRecently;
      });
      
      setDuels(filteredDuels as Duel[]);
    } catch (error) {
      console.error('Error cargando duelos:', error);
      toast.error('No se pudieron cargar los duelos');
    } finally {
      setDuelsLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return;

    setLoading(true);
    try {
      // Usar vista pública para buscar otros usuarios (sin datos sensibles)
      const { data, error } = await supabase
        .from('profiles_public')
        .select('id, username, avatar_url, color, total_points, total_territories')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', user.id)
        .limit(10);

      if (error) throw error;

      // Filtrar usuarios que ya son amigos o tienen solicitudes pendientes
      const friendIds = friends.map(f => f.friend_id);
      const pendingIds = pendingRequests.map(r => r.user_id);
      
      const filtered = data?.filter(
        u => !friendIds.includes(u.id) && !pendingIds.includes(u.id)
      ) || [];

      setSearchResults(filtered);
    } catch (error) {
      console.error('Error buscando usuarios:', error);
      toast.error('Error al buscar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (friendId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: friendId,
          status: 'pending',
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Ya enviaste una solicitud a este usuario');
        } else {
          throw error;
        }
        return;
      }

      // Crear notificación para el usuario que recibe la solicitud
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      await supabase
        .from('notifications')
        .insert({
          user_id: friendId,
          type: 'friend_request',
          title: 'Nueva solicitud de amistad',
          message: `${senderProfile?.username || 'Un usuario'} te ha enviado una solicitud de amistad`,
          related_id: friendId
        });

      toast.success('Solicitud enviada');
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      console.error('Error enviando solicitud:', error);
      toast.error('Error al enviar solicitud');
    }
  };

  const acceptRequest = async (friendshipId: string, senderId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) throw error;

      // Crear notificación para el usuario que envió la solicitud
      const { data: accepterProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user?.id)
        .single();

      await supabase
        .from('notifications')
        .insert({
          user_id: senderId,
          type: 'friend_accepted',
          title: 'Solicitud aceptada',
          message: `${accepterProfile?.username || 'Un usuario'} ha aceptado tu solicitud de amistad`,
          related_id: user?.id
        });

      toast.success('¡Nuevo amigo añadido!');
      loadFriends();
      loadPendingRequests();
    } catch (error) {
      console.error('Error aceptando solicitud:', error);
      toast.error('Error al aceptar solicitud');
    }
  };

  const rejectRequest = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      toast.error('Error rechazando solicitud');
      console.error(error);
    } else {
      toast.success('Solicitud rechazada');
      loadPendingRequests();
    }
  };

  const removeFriend = async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      toast.error('Error eliminando amigo');
      console.error(error);
    } else {
      toast.success('Amigo eliminado');
      loadFriends();
    }
  };

  const friendOptions = friends.map((friendship) => ({
    id: friendship.friend_id,
    username: friendship.friend_profile?.username || 'Amigo',
  }));
  const friendNameMap = new Map(friendOptions.map(option => [option.id, option.username]));

  const renderDuelsSection = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Swords className="w-4 h-4 text-primary" />
          Duelos activos
        </div>
        {friendOptions.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDuelForm(prev => !prev)}
          >
            {showDuelForm ? 'Cerrar' : 'Crear duelo'}
          </Button>
        )}
      </div>
      {friendOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">Añade amigos para desbloquear los duelos 1v1.</p>
      )}
      {showDuelForm && friendOptions.length > 0 && (
        <Card className="p-3 space-y-3 bg-muted/30 border-border">
          <Select value={duelFriend} onValueChange={setDuelFriend}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un amigo" />
            </SelectTrigger>
            <SelectContent>
              {friendOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select value={currentDuelType} onValueChange={(val) => setCurrentDuelType(val as DuelType)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de duelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">Distancia</SelectItem>
                <SelectItem value="points">Puntos</SelectItem>
                <SelectItem value="arena">Arena</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={duelTarget}
              onChange={(e) => setDuelTarget(e.target.value)}
              placeholder="Meta (ej. 20000)"
              inputMode="numeric"
            />
          </div>
          <Button onClick={createDuel} disabled={creatingDuel || !duelFriend}>
            {creatingDuel && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Lanzar reto
          </Button>
        </Card>
      )}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {duelsLoading ? (
          <ContentSkeleton type="friends" count={2} />
        ) : duels.length === 0 ? (
          <EmptyState 
            type="duels" 
            className="py-6"
            description="Añade amigos y reta a duelos 1v1."
          />
        ) : (
          duels.map((duel) => {
            const challenger = duel.challenger_id === user?.id ? 'Tú' : (friendNameMap.get(duel.challenger_id) || 'Rival');
            const opponent = duel.opponent_id === user?.id ? 'Tú' : (friendNameMap.get(duel.opponent_id) || 'Rival');
            const statusColor = duel.status === 'completed'
              ? 'text-emerald-400'
              : duel.status === 'pending'
                ? 'text-amber-400'
                : 'text-primary';
            return (
              <Card key={duel.id} className="p-3 bg-muted/30 border-border">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{duelTypeLabels[duel.duel_type] || duel.duel_type} · meta {duel.target_value}</span>
                  <span className={`text-xs ${statusColor}`}>{duel.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {challenger} {duel.challenger_progress} vs {opponent} {duel.opponent_progress}
                </p>
                <p className="text-xs text-muted-foreground">
                  Termina: {new Date(duel.end_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );

  const createDuel = async () => {
    if (!user) return;
    if (!duelFriend) {
      toast.error('Selecciona un amigo para retar');
      return;
    }
    setCreatingDuel(true);
    try {
      const payload = {
        challenger_id: user.id,
        opponent_id: duelFriend,
        duel_type: currentDuelType,
        target_value: parseInt(duelTarget, 10) || 20000,
        status: 'active' as const,
        start_at: new Date().toISOString(),
        end_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      };
      const { error } = await supabase.from('duels').insert([payload]);
      if (error) throw error;
      toast.success('Duelo lanzado');
      setDuelFriend('');
      setDuelTarget('20000');
      setCurrentDuelType('distance');
      setShowDuelForm(false);
      loadDuels();
    } catch (error) {
      console.error('Error creando duelo:', error);
      toast.error('No se pudo crear el duelo');
    } finally {
      setCreatingDuel(false);
    }
  };

  if (isMobileFullPage) {
    // Mobile full page version without overlay
    return (
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
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold glow-primary">Social</h2>
          </div>

          <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as 'friends' | 'lobbies')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="friends" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Amigos
              </TabsTrigger>
              <TabsTrigger value="lobbies" className="flex items-center gap-2">
                <Users2 className="w-4 h-4" />
                Lobbies
              </TabsTrigger>
            </TabsList>

            <TabsContent value="friends" className="space-y-6 mt-4">
              {/* Buscar usuarios */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">Buscar usuarios</h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                      placeholder="Buscar por nombre de usuario..."
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={searchUsers} disabled={loading || !searchQuery.trim()}>
                    Buscar
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {searchResults.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback style={{ backgroundColor: profile.color }}>
                              {profile.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{profile.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {profile.total_points} pts • {profile.total_territories} territorios
                            </p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => sendFriendRequest(profile.id)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Añadir
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Solicitudes pendientes */}
              {pendingRequests.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Solicitudes pendientes ({pendingRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={request.friend_profile?.avatar_url || undefined} />
                            <AvatarFallback
                              style={{ backgroundColor: request.friend_profile?.color }}
                            >
                              {request.friend_profile?.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-semibold">{request.friend_profile?.username}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => acceptRequest(request.id, request.user_id)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => rejectRequest(request.id)}
                          >
                            <XIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {renderDuelsSection()}

              {/* Lista de amigos */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  Mis amigos ({friends.length})
                </h3>
                {friends.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Aún no tienes amigos</p>
                    <p className="text-sm">Busca usuarios y añádelos como amigos</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends.map((friendship) => (
                      <div
                        key={friendship.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => onViewUserProfile?.(friendship.friend_id)}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="w-10 h-10">
                            <AvatarImage
                              src={friendship.friend_profile?.avatar_url || undefined}
                            />
                            <AvatarFallback
                              style={{ backgroundColor: friendship.friend_profile?.color }}
                            >
                              {friendship.friend_profile?.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{friendship.friend_profile?.username}</p>
                            <p className="text-xs text-muted-foreground">
                              {friendship.friend_profile?.total_points} pts •{' '}
                              {friendship.friend_profile?.total_territories} territorios
                            </p>
                            {friendClans[friendship.friend_id] && (
                              <p className="text-xs text-primary flex items-center gap-1">
                                <Shield className="w-3 h-3" /> {friendClans[friendship.friend_id].name}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFriend(friendship.id);
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="lobbies" className="mt-4">
              <Lobbies />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // Desktop modal version
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4 animate-fade-in">
      <Card className="w-full max-w-2xl bg-card border-glow p-4 md:p-6 space-y-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold glow-primary">Social</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className={isMobileFullPage ? 'hidden' : ''}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as 'friends' | 'lobbies')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Amigos
            </TabsTrigger>
            <TabsTrigger value="lobbies" className="flex items-center gap-2">
              <Users2 className="w-4 h-4" />
              Lobbies
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4 mt-4">
            {/* Buscar usuarios */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">Buscar usuarios</h3>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                    placeholder="Buscar por nombre de usuario..."
                    className="pl-10"
                  />
                </div>
                <Button onClick={searchUsers} disabled={loading || !searchQuery.trim()}>
                  Buscar
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-auto">
                  {searchResults.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback style={{ backgroundColor: profile.color }}>
                            {profile.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{profile.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {profile.total_points} pts • {profile.total_territories} territorios
                          </p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => sendFriendRequest(profile.id)}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Añadir
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Solicitudes pendientes */}
            {pendingRequests.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  Solicitudes pendientes ({pendingRequests.length})
                </h3>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={request.friend_profile?.avatar_url || undefined} />
                          <AvatarFallback
                            style={{ backgroundColor: request.friend_profile?.color }}
                          >
                            {request.friend_profile?.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-semibold">{request.friend_profile?.username}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => acceptRequest(request.id, request.user_id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => rejectRequest(request.id)}
                        >
                          <XIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {renderDuelsSection()}

            {/* Lista de amigos */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">
                Mis amigos ({friends.length})
              </h3>
              {friends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Aún no tienes amigos</p>
                  <p className="text-sm">Busca usuarios y añádelos como amigos</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friendship) => (
                    <div
                      key={friendship.id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => onViewUserProfile?.(friendship.friend_id)}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Avatar className="w-10 h-10">
                          <AvatarImage
                            src={friendship.friend_profile?.avatar_url || undefined}
                          />
                          <AvatarFallback
                            style={{ backgroundColor: friendship.friend_profile?.color }}
                          >
                            {friendship.friend_profile?.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{friendship.friend_profile?.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {friendship.friend_profile?.total_points} pts •{' '}
                            {friendship.friend_profile?.total_territories} territorios
                          </p>
                          {friendClans[friendship.friend_id] && (
                            <p className="text-xs text-primary flex items-center gap-1">
                              <Shield className="w-3 h-3" /> {friendClans[friendship.friend_id].name}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFriend(friendship.id);
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lobbies" className="mt-4">
            <Lobbies />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Friends;
