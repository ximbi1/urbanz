import { X, Trophy, Medal, MapPin, Route } from 'lucide-react';
import { ContentSkeleton } from './ui/content-skeleton';
import { EmptyState } from './ui/empty-state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface RankingProps {
  onClose: () => void;
}

interface RankingEntry {
  id: string;
  username: string;
  total_points: number;
  total_territories: number;
  total_distance: number;
  color: string;
  avatar_url: string | null;
}

const Ranking = ({ onClose }: RankingProps) => {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [friendRankings, setFriendRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'territories' | 'distance'>('territories');
  const [viewMode, setViewMode] = useState<'global' | 'friends'>('global');
  const { user } = useAuth();

  useEffect(() => {
    loadRankings();
    loadFriendRankings();
  }, []);

  const loadRankings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, total_points, total_territories, total_distance, color, avatar_url')
        .order('total_territories', { ascending: false });

      if (error) throw error;
      
      setRankings(data || []);
    } catch (error) {
      console.error('Error loading rankings:', error);
      toast.error('Error al cargar el ranking');
    } finally {
      setLoading(false);
    }
  };

  const loadFriendRankings = async () => {
    if (!user) return;
    
    try {
      // Obtener IDs de amigos aceptados
      const { data: friendships, error: friendError } = await supabase
        .from('friendships')
        .select('friend_id, user_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (friendError) throw friendError;

      // Extraer IDs de amigos
      const friendIds = friendships
        ?.map(f => f.user_id === user.id ? f.friend_id : f.user_id)
        .filter(id => id !== user.id) || [];

      if (friendIds.length === 0) {
        setFriendRankings([]);
        return;
      }

      // Obtener perfiles de amigos + incluir al usuario actual
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, total_points, total_territories, total_distance, color, avatar_url')
        .in('id', [...friendIds, user.id])
        .order('total_territories', { ascending: false });

      if (error) throw error;

      let rankingsData = data || [];

      // Asegurar que el usuario actual siempre está incluido en el ranking de amigos
      const hasCurrentUser = rankingsData.some((entry) => entry.id === user.id);

      if (!hasCurrentUser) {
        const usernameFromMeta =
          (user.user_metadata && (user.user_metadata as any).username) ||
          (user.email ? user.email.split('@')[0] : 'Runner');

        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          username: usernameFromMeta,
        });

        if (insertError) {
          console.error('Error creating user profile for rankings:', insertError);
        } else {
          const { data: updatedData, error: updatedError } = await supabase
            .from('profiles')
            .select('id, username, total_points, total_territories, total_distance, color, avatar_url')
            .in('id', [...friendIds, user.id])
            .order('total_territories', { ascending: false });

          if (!updatedError && updatedData) {
            rankingsData = updatedData;
          }
        }
      }

      setFriendRankings(rankingsData);
    } catch (error) {
      console.error('Error loading friend rankings:', error);
    }
  };

  const getSortedRankings = () => {
    const dataToSort = viewMode === 'global' ? rankings : friendRankings;
    return [...dataToSort].sort((a, b) => {
      if (sortBy === 'territories') {
        return b.total_territories - a.total_territories;
      }
      return b.total_distance - a.total_distance;
    });
  };

  const getMedalIcon = (position: number) => {
    if (position === 0) return <Trophy className="w-5 h-5 text-warning" />;
    if (position === 1) return <Medal className="w-5 h-5 text-muted-foreground" />;
    if (position === 2) return <Medal className="w-5 h-5 text-[#CD7F32]" />;
    return null;
  };

  const sortedRankings = getSortedRankings();

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-glow p-6 space-y-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display font-bold glow-primary">
            {viewMode === 'global' ? 'Ranking Global' : 'Ranking de Amigos'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Selector de modo */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'global' | 'friends')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="friends">Amigos</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as 'territories' | 'distance')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="territories" className="gap-2">
              <MapPin className="w-4 h-4" />
              Territorios
            </TabsTrigger>
            <TabsTrigger value="distance" className="gap-2">
              <Route className="w-4 h-4" />
              Distancia
            </TabsTrigger>
          </TabsList>

          <TabsContent value={sortBy} className="space-y-2 mt-4 overflow-auto flex-1">
            {loading ? (
              <ContentSkeleton type="ranking" count={8} />
            ) : sortedRankings.length === 0 ? (
              <EmptyState 
                type={viewMode === 'friends' ? 'friends' : 'achievements'}
                title={viewMode === 'friends' ? 'Sin amigos todavía' : 'Sin datos'}
                description={viewMode === 'friends' 
                  ? 'Añade amigos para ver el ranking social'
                  : 'No hay datos de ranking disponibles'
                }
              />
            ) : (
              sortedRankings.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    entry.id === user?.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border border-border font-display font-bold flex-shrink-0">
                    {getMedalIcon(index) || index + 1}
                  </div>
                  
                  <Avatar className="w-10 h-10 border-2 border-background flex-shrink-0" style={{ borderColor: entry.color }}>
                    <AvatarImage src={entry.avatar_url || undefined} alt={entry.username} />
                    <AvatarFallback className="text-sm font-semibold">
                      {entry.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{entry.username}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {entry.total_territories}
                      </span>
                      <span className="flex items-center gap-1">
                        <Route className="w-3 h-3" />
                        {(entry.total_distance / 1000).toFixed(1)} km
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <div className="font-display font-bold text-primary">
                      {sortBy === 'territories' ? entry.total_territories : (entry.total_distance / 1000).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sortBy === 'territories' ? 'territorios' : 'km'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Ranking;
