import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Copy, Plus, Users, LogOut, Crown, Check, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface Lobby {
  id: string;
  name: string;
  invite_code: string;
  creator_id: string;
  is_active: boolean;
  max_members: number;
  created_at: string;
}

interface LobbyMember {
  id: string;
  user_id: string;
  joined_at: string;
  profile?: {
    username: string;
    avatar_url: string | null;
    color: string;
  };
}

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  color: string;
}

interface LobbiesProps {
  onSelectLobby?: (lobbyId: string | null) => void;
  selectedLobbyId?: string | null;
}

export const Lobbies = ({ onSelectLobby, selectedLobbyId }: LobbiesProps) => {
  const { user } = useAuth();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [lobbyMembers, setLobbyMembers] = useState<Record<string, LobbyMember[]>>({});
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedLobbyForInvite, setSelectedLobbyForInvite] = useState<string | null>(null);
  const [newLobbyName, setNewLobbyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLobbies();
      fetchFriends();
    }
  }, [user]);

  const fetchLobbies = async () => {
    if (!user) return;
    
    try {
      // Obtener lobbies donde soy miembro
      const { data: memberData } = await supabase
        .from('lobby_members')
        .select('lobby_id')
        .eq('user_id', user.id);

      const lobbyIds = memberData?.map(m => m.lobby_id) || [];

      // Obtener lobbies que creé o donde soy miembro
      const { data: lobbiesData, error } = await supabase
        .from('lobbies')
        .select('*')
        .or(`creator_id.eq.${user.id},id.in.(${lobbyIds.join(',') || 'null'})`);

      if (error) throw error;

      setLobbies(lobbiesData || []);

      // Obtener miembros de cada lobby
      for (const lobby of lobbiesData || []) {
        fetchLobbyMembers(lobby.id);
      }
    } catch (error) {
      console.error('Error fetching lobbies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLobbyMembers = async (lobbyId: string) => {
    const { data: members } = await supabase
      .from('lobby_members')
      .select('id, user_id, joined_at')
      .eq('lobby_id', lobbyId);

    if (members && members.length > 0) {
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, color')
        .in('id', userIds);

      const membersWithProfiles = members.map(m => ({
        ...m,
        profile: profiles?.find(p => p.id === m.user_id),
      }));

      setLobbyMembers(prev => ({ ...prev, [lobbyId]: membersWithProfiles }));
    }
  };

  const fetchFriends = async () => {
    if (!user) return;

    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (friendships) {
      const friendIds = friendships.map(f => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, color')
        .in('id', friendIds);

      setFriends(profiles || []);
    }
  };

  const createLobby = async () => {
    if (!user || !newLobbyName.trim()) return;

    setCreating(true);
    try {
      const { data: lobby, error } = await supabase
        .from('lobbies')
        .insert({
          name: newLobbyName.trim(),
          creator_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-unirse como creador
      await supabase
        .from('lobby_members')
        .insert({
          lobby_id: lobby.id,
          user_id: user.id,
        });

      // Invitar amigos seleccionados
      if (selectedFriends.length > 0) {
        const invites = selectedFriends.map(friendId => ({
          lobby_id: lobby.id,
          user_id: friendId,
        }));
        
        // Crear notificaciones para los amigos
        const notifications = selectedFriends.map(friendId => ({
          user_id: friendId,
          type: 'lobby_invite',
          title: 'Invitación a lobby',
          message: `Te han invitado a unirte a "${lobby.name}". Código: ${lobby.invite_code}`,
          related_id: lobby.id,
        }));

        await supabase.from('notifications').insert(notifications);
      }

      toast.success('Lobby creado correctamente');
      setCreateDialogOpen(false);
      setNewLobbyName('');
      setSelectedFriends([]);
      fetchLobbies();
    } catch (error: any) {
      toast.error('Error al crear lobby: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const joinLobbyByCode = async () => {
    if (!user || !joinCode.trim()) return;

    setJoining(true);
    try {
      // Buscar lobby por código
      const { data: lobby, error: findError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (findError || !lobby) {
        toast.error('Código de invitación no válido');
        return;
      }

      // Verificar si ya es miembro
      const { data: existing } = await supabase
        .from('lobby_members')
        .select('id')
        .eq('lobby_id', lobby.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        toast.info('Ya eres miembro de este lobby');
        return;
      }

      // Unirse al lobby
      const { error } = await supabase
        .from('lobby_members')
        .insert({
          lobby_id: lobby.id,
          user_id: user.id,
        });

      if (error) throw error;

      toast.success(`Te has unido a "${lobby.name}"`);
      setJoinDialogOpen(false);
      setJoinCode('');
      fetchLobbies();
    } catch (error: any) {
      toast.error('Error al unirse: ' + error.message);
    } finally {
      setJoining(false);
    }
  };

  const leaveLobby = async (lobbyId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('lobby_members')
        .delete()
        .eq('lobby_id', lobbyId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Has salido del lobby');
      if (selectedLobbyId === lobbyId) {
        onSelectLobby?.(null);
      }
      fetchLobbies();
    } catch (error: any) {
      toast.error('Error al salir: ' + error.message);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado al portapapeles');
  };

  const inviteFriendsToLobby = async () => {
    if (!selectedLobbyForInvite || selectedFriends.length === 0) return;

    try {
      const lobby = lobbies.find(l => l.id === selectedLobbyForInvite);
      if (!lobby) return;

      const notifications = selectedFriends.map(friendId => ({
        user_id: friendId,
        type: 'lobby_invite',
        title: 'Invitación a lobby',
        message: `Te han invitado a unirte a "${lobby.name}". Código: ${lobby.invite_code}`,
        related_id: lobby.id,
      }));

      await supabase.from('notifications').insert(notifications);

      toast.success('Invitaciones enviadas');
      setInviteDialogOpen(false);
      setSelectedFriends([]);
      setSelectedLobbyForInvite(null);
    } catch (error: any) {
      toast.error('Error al invitar: ' + error.message);
    }
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex-1">
              <Plus className="w-4 h-4 mr-2" />
              Crear Lobby
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Lobby Privado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre del lobby</Label>
                <Input
                  value={newLobbyName}
                  onChange={(e) => setNewLobbyName(e.target.value)}
                  placeholder="Ej: Runners de Madrid"
                />
              </div>
              
              {friends.length > 0 && (
                <div>
                  <Label>Invitar amigos (opcional)</Label>
                  <ScrollArea className="h-40 mt-2 border rounded-md p-2">
                    {friends.map(friend => (
                      <div
                        key={friend.id}
                        className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer"
                        onClick={() => toggleFriendSelection(friend.id)}
                      >
                        <Checkbox checked={selectedFriends.includes(friend.id)} />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={friend.avatar_url || undefined} />
                          <AvatarFallback style={{ backgroundColor: friend.color }}>
                            {friend.username[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{friend.username}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              <Button 
                onClick={createLobby} 
                disabled={creating || !newLobbyName.trim()}
                className="w-full"
              >
                {creating ? 'Creando...' : 'Crear Lobby'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1">
              <Users className="w-4 h-4 mr-2" />
              Unirse
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unirse a Lobby</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Código de invitación</Label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ej: ABC123"
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <Button 
                onClick={joinLobbyByCode} 
                disabled={joining || joinCode.length !== 6}
                className="w-full"
              >
                {joining ? 'Uniéndose...' : 'Unirse'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {lobbies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No estás en ningún lobby</p>
            <p className="text-sm">Crea uno o únete con un código</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {lobbies.map(lobby => {
            const members = lobbyMembers[lobby.id] || [];
            const isCreator = lobby.creator_id === user?.id;
            const isSelected = selectedLobbyId === lobby.id;

            return (
              <Card 
                key={lobby.id}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
                }`}
                onClick={() => onSelectLobby?.(isSelected ? null : lobby.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {lobby.name}
                      {isCreator && <Crown className="w-4 h-4 text-yellow-500" />}
                      {isSelected && <Check className="w-4 h-4 text-primary" />}
                    </CardTitle>
                    <Badge variant="secondary" className="font-mono">
                      {lobby.invite_code}
                      <Copy 
                        className="w-3 h-3 ml-1 cursor-pointer" 
                        onClick={(e) => {
                          e.stopPropagation();
                          copyInviteCode(lobby.invite_code);
                        }}
                      />
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {members.slice(0, 5).map(member => (
                        <Avatar key={member.id} className="h-7 w-7 border-2 border-background">
                          <AvatarImage src={member.profile?.avatar_url || undefined} />
                          <AvatarFallback 
                            className="text-xs"
                            style={{ backgroundColor: member.profile?.color }}
                          >
                            {member.profile?.username?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {members.length > 5 && (
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                          +{members.length - 5}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLobbyForInvite(lobby.id);
                          setInviteDialogOpen(true);
                        }}
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      {!isCreator && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            leaveLobby(lobby.id);
                          }}
                        >
                          <LogOut className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog para invitar amigos a lobby existente */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Amigos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {friends.length > 0 ? (
              <>
                <ScrollArea className="h-60 border rounded-md p-2">
                  {friends.map(friend => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted rounded cursor-pointer"
                      onClick={() => toggleFriendSelection(friend.id)}
                    >
                      <Checkbox checked={selectedFriends.includes(friend.id)} />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={friend.avatar_url || undefined} />
                        <AvatarFallback style={{ backgroundColor: friend.color }}>
                          {friend.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{friend.username}</span>
                    </div>
                  ))}
                </ScrollArea>
                <Button 
                  onClick={inviteFriendsToLobby}
                  disabled={selectedFriends.length === 0}
                  className="w-full"
                >
                  Enviar Invitaciones ({selectedFriends.length})
                </Button>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No tienes amigos para invitar
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
