import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Duel } from '@/types/territory';
import { toast } from 'sonner';
import { Loader2, Swords, X } from 'lucide-react';

interface DuelModalProps {
  onClose: () => void;
}

export const DuelModal = ({ onClose }: DuelModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [duels, setDuels] = useState<Duel[]>([]);
  const [friends, setFriends] = useState<{ id: string; username: string }[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string>('');
  const [duelType, setDuelType] = useState<'distance' | 'points' | 'arena'>('distance');
  const [target, setTarget] = useState('20000');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: duelRows }, { data: friendsRows }] = await Promise.all([
          supabase
            .from('duels')
            .select('*')
            .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
            .order('created_at', { ascending: false }),
          supabase
            .from('friendships')
            .select('user_id, friend_id, status, profiles:friend_id (username)')
            .eq('status', 'accepted')
            .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`),
        ]);

        setDuels(duelRows as Duel[] || []);

        const mappedFriends: { id: string; username: string }[] = [];
        (friendsRows || []).forEach((row: any) => {
          const friendId = row.user_id === user.id ? row.friend_id : row.user_id;
          const username = row.profiles?.username || 'Amigo';
          mappedFriends.push({ id: friendId, username });
        });
        setFriends(mappedFriends);
      } catch (error) {
        console.error('Error cargando duelos', error);
        toast.error('No se pudieron cargar los duelos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const createDuel = async () => {
    if (!user) return;
    if (!selectedFriend) {
      toast.error('Selecciona un amigo');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        challenger_id: user.id,
        opponent_id: selectedFriend,
        duel_type: duelType,
        target_value: parseInt(target, 10) || 20000,
        status: 'active',
        start_at: new Date().toISOString(),
        end_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      };
      const { data, error } = await supabase.from('duels').insert(payload).select('*').single();
      if (error) throw error;
      toast.success('Duelo iniciado');
      setDuels((prev) => [data as Duel, ...prev]);
    } catch (error) {
      console.error('Error creando duelo', error);
      toast.error('No se pudo crear el duelo');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="p-6 bg-card text-center border-glow">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Cargando duelos...
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-3xl bg-card border-glow p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Duelos 1v1</p>
            <h3 className="text-2xl font-display font-bold">Reta a tus amigos</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Card className="p-4 bg-muted/20 space-y-3">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold">Nuevo duelo</p>
          </div>
          <Select value={selectedFriend} onValueChange={setSelectedFriend}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un amigo" />
            </SelectTrigger>
            <SelectContent>
              {friends.map(friend => (
                <SelectItem key={friend.id} value={friend.id}>{friend.username}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select value={duelType} onValueChange={(val) => setDuelType(val as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="distance">Distancia</SelectItem>
                <SelectItem value="points">Puntos</SelectItem>
                <SelectItem value="arena">Arena</SelectItem>
              </SelectContent>
            </Select>
            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Meta (ej. 20000)" />
          </div>
          <Button onClick={createDuel} disabled={creating}>
            Lanzar reto
          </Button>
        </Card>

        <div className="space-y-2 max-h-72 overflow-y-auto">
          {duels.map(duel => (
            <Card key={duel.id} className="p-3 bg-muted/30 border-border">
              <div className="flex items-center justify-between font-semibold text-sm">
                <span>{duel.duel_type} · meta {duel.target_value}</span>
                <span className={`text-xs ${duel.status === 'completed' ? 'text-emerald-400' : 'text-primary'}`}>{duel.status}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {duel.challenger_progress} vs {duel.opponent_progress}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Termina: {new Date(duel.end_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </Card>
          ))}
          {duels.length === 0 && <p className="text-sm text-muted-foreground">Todavía no tienes duelos activos.</p>}
        </div>
      </Card>
    </div>
  );
};
