import { X, Trophy, Medal, MapPin, Route, Crown, Gem, Award, Users } from 'lucide-react';
import { ContentSkeleton } from './ui/content-skeleton';
import { EmptyState } from './ui/empty-state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SeasonInfo from './SeasonInfo';

interface LeaguesProps {
  onClose: () => void;
  isMobileFullPage?: boolean;
}

interface LeagueEntry {
  id: string;
  username: string;
  season_points: number;
  social_points: number;
  total_points: number;
  current_league: string;
  color: string;
  avatar_url: string | null;
}

interface Season {
  id: string;
  name: string;
  end_date: string;
}

interface ClanHighlight {
  id: string;
  name: string;
  description: string | null;
  banner_color: string | null;
  total_points: number;
  territories_controlled: number;
}

const LEAGUE_CONFIG = {
  legend: { name: 'Leyenda', icon: Crown, color: 'text-warning', min: 7000 },
  diamond: { name: 'Diamante', icon: Gem, color: 'text-secondary', min: 3500 },
  gold: { name: 'Oro', icon: Trophy, color: 'text-warning', min: 1500 },
  silver: { name: 'Plata', icon: Medal, color: 'text-muted-foreground', min: 500 },
  bronze: { name: 'Bronce', icon: Award, color: 'text-[#CD7F32]', min: 0 },
};

const Leagues = ({ onClose, isMobileFullPage = false }: LeaguesProps) => {
  const [myLeagueRankings, setMyLeagueRankings] = useState<LeagueEntry[]>([]);
  const [friendsLeagues, setFriendsLeagues] = useState<LeagueEntry[]>([]);
  const [socialLeagueRankings, setSocialLeagueRankings] = useState<LeagueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'my-league' | 'friends' | 'social'>('my-league');
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [userLeague, setUserLeague] = useState<string>('bronze');
  const [topClans, setTopClans] = useState<ClanHighlight[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    loadCurrentSeason();
    loadUserLeague();
    loadMyLeagueRankings();
    loadFriendsLeagues();
    loadSocialLeagueRankings();
    loadTopClans();
  }, []);

  const loadCurrentSeason = async () => {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('active', true)
        .single();

      if (error) throw error;
      setCurrentSeason(data);
    } catch (error) {
      console.error('Error loading season:', error);
    }
  };

  const loadUserLeague = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('current_league')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) setUserLeague(data.current_league);
    } catch (error) {
      console.error('Error loading user league:', error);
    }
  };

  const loadMyLeagueRankings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Primero obtener la liga del usuario
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('current_league')
        .eq('id', user.id)
        .single();

      const league = userProfile?.current_league || 'bronze';

      // Obtener top 30 de la misma liga, ordenados por puntos
      let { data, error } = await supabase
        .from('profiles')
        .select('id, username, season_points, social_points, total_points, current_league, color, avatar_url')
        .eq('current_league', league)
        .limit(30);

      if (error) throw error;
      
      // Ordenar manualmente por season_points o total_points (el que sea mayor)
      const sorted = (data || []).map(p => ({
        ...p,
        social_points: p.social_points ?? 0,
      })).sort((a, b) => {
        const pointsA = Math.max(a.season_points || 0, a.total_points || 0);
        const pointsB = Math.max(b.season_points || 0, b.total_points || 0);
        return pointsB - pointsA;
      });

      
      setMyLeagueRankings(sorted);
    } catch (error) {
      console.error('Error loading league rankings:', error);
      toast.error('Error al cargar la liga');
    } finally {
      setLoading(false);
    }
  };

  const loadFriendsLeagues = async () => {
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
        setFriendsLeagues([]);
        return;
      }

      // Obtener perfiles de amigos + incluir al usuario actual
      let { data, error } = await supabase
        .from('profiles')
        .select('id, username, season_points, social_points, total_points, current_league, color, avatar_url')
        .in('id', [...friendIds, user.id]);

      if (error) throw error;

      // Ordenar manualmente por season_points o total_points (el que sea mayor)
      const sorted = (data || []).map(p => ({
        ...p,
        social_points: p.social_points ?? 0,
      })).sort((a, b) => {
        const pointsA = Math.max(a.season_points || 0, a.total_points || 0);
        const pointsB = Math.max(b.season_points || 0, b.total_points || 0);
        return pointsB - pointsA;
      });


      setFriendsLeagues(sorted);
    } catch (error) {
      console.error('Error loading friends leagues:', error);
    }
  };

  const loadSocialLeagueRankings = async () => {
    try {
      // Obtener top 30 de Liga Social ordenados por social_points
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, season_points, social_points, total_points, current_league, color, avatar_url')
        .eq('social_league', true)
        .gt('social_points', 0)
        .order('social_points', { ascending: false })
        .limit(30);

      if (error) throw error;
      
      const sorted = (data || []).map(p => ({
        ...p,
        social_points: p.social_points ?? 0,
      }));

      setSocialLeagueRankings(sorted);
    } catch (error) {
      console.error('Error loading social league rankings:', error);
    }
  };

  const loadTopClans = async () => {
    try {
      const { data, error } = await supabase
        .from('clans')
        .select('id, name, description, banner_color, total_points, territories_controlled')
        .order('total_points', { ascending: false })
        .limit(5);

      if (error) throw error;
      setTopClans(data || []);
    } catch (error) {
      console.error('Error cargando mejores clanes:', error);
    }
  };

  const getLeagueIcon = (league: string) => {
    const config = LEAGUE_CONFIG[league as keyof typeof LEAGUE_CONFIG];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className={`w-4 h-4 ${config.color}`} />;
  };

  const getLeagueName = (league: string) => {
    return LEAGUE_CONFIG[league as keyof typeof LEAGUE_CONFIG]?.name || 'Bronce';
  };

  const getMedalIcon = (position: number) => {
    if (position === 0) return <Trophy className="w-5 h-5 text-warning" />;
    if (position === 1) return <Medal className="w-5 h-5 text-muted-foreground" />;
    if (position === 2) return <Medal className="w-5 h-5 text-[#CD7F32]" />;
    return null;
  };

  const renderTopClansCard = () => (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="w-4 h-4 text-primary" />
        <div>
          <h3 className="font-semibold">Mejores clanes</h3>
          <p className="text-xs text-muted-foreground">Basado en puntos de influencia</p>
        </div>
      </div>
      {topClans.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay clanes registrados.</p>
      ) : (
        <div className="space-y-2">
          {topClans.map((clan, index) => (
            <div key={clan.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">#{index + 1}</span>
                  {clan.name}
                </p>
                <p className="text-xs text-muted-foreground">{clan.description || 'Clan en expansión urbana'}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{clan.total_points} pts</p>
                <p className="text-xs text-muted-foreground">{clan.territories_controlled} territorios</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  if (isMobileFullPage) {
    return (
      <div className="w-full h-full flex flex-col bg-background">
        <div className="container mx-auto px-4 py-6 space-y-4 flex-1 overflow-y-auto pb-24">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-display font-bold glow-primary">Ligas</h2>
          </div>

          {/* Información de la temporada */}
          {currentSeason && <SeasonInfo season={currentSeason} />}

          {/* Liga actual del usuario */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
            {getLeagueIcon(userLeague)}
            <span className="font-semibold">Tu liga: {getLeagueName(userLeague)}</span>
          </div>

          {/* Selector de modo */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'my-league' | 'friends' | 'social')} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="my-league">Mi Liga</TabsTrigger>
              <TabsTrigger value="friends">Amigos</TabsTrigger>
              <TabsTrigger value="social" className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                Social
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2 overflow-auto flex-1">
            {loading ? (
              <ContentSkeleton type="ranking" count={6} />
            ) : viewMode === 'social' ? (
              socialLeagueRankings.length === 0 ? (
                <EmptyState 
                  type="achievements"
                  title="Sin corredores sociales"
                  description="Aún no hay corredores en la Liga Social"
                />
              ) : (
                socialLeagueRankings.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      entry.id === user?.id
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 font-display font-bold flex-shrink-0 text-green-400">
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
                      <div className="text-xs text-green-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Liga Social
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <div className="font-display font-bold text-green-400">
                        {entry.social_points}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        pts sociales
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : viewMode === 'my-league' ? (
              myLeagueRankings.length === 0 ? (
                <EmptyState 
                  type="achievements"
                  title="Sin competidores"
                  description="No hay otros corredores en tu liga todavía"
                />
              ) : (
                myLeagueRankings.map((entry, index) => (
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
                      <div className="text-xs text-muted-foreground">
                        {entry.season_points || entry.total_points} puntos
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <div className="font-display font-bold text-primary">
                        {entry.season_points || entry.total_points}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        pts
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              friendsLeagues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tienes amigos aceptados aún
                </div>
              ) : (
                friendsLeagues.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      entry.id === user?.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <Avatar className="w-10 h-10 border-2 border-background flex-shrink-0" style={{ borderColor: entry.color }}>
                      <AvatarImage src={entry.avatar_url || undefined} alt={entry.username} />
                      <AvatarFallback className="text-sm font-semibold">
                        {entry.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{entry.username}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        {getLeagueIcon(entry.current_league)}
                        {getLeagueName(entry.current_league)}
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <div className="font-display font-bold text-primary">
                        {entry.season_points || entry.total_points}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        pts
                      </div>
                    </div>
                  </div>
                ))
              )
          )}
        </div>
        <div className="pt-2">
          {renderTopClansCard()}
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-glow p-6 space-y-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display font-bold glow-primary">
            Ligas
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Información de la temporada */}
        {currentSeason && <SeasonInfo season={currentSeason} />}

        {/* Liga actual del usuario */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-2">
            {getLeagueIcon(userLeague)}
            <span className="font-semibold">Tu liga: {getLeagueName(userLeague)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Shard activo: {userLeague}-1
          </div>
        </div>

        {/* Selector de modo */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'my-league' | 'friends' | 'social')} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="my-league">Mi Liga</TabsTrigger>
            <TabsTrigger value="friends">Amigos</TabsTrigger>
            <TabsTrigger value="social" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              Social
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2 overflow-auto flex-1">
          {loading ? (
            <ContentSkeleton type="ranking" count={6} />
          ) : viewMode === 'social' ? (
            socialLeagueRankings.length === 0 ? (
              <EmptyState 
                type="achievements"
                title="Sin corredores sociales"
                description="Aún no hay corredores en la Liga Social"
              />
            ) : (
              socialLeagueRankings.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    entry.id === user?.id
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 font-display font-bold flex-shrink-0 text-green-400">
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
                    <div className="text-xs text-green-400 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Liga Social
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <div className="font-display font-bold text-green-400">
                      {entry.social_points}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      pts sociales
                    </div>
                  </div>
                </div>
              ))
            )
          ) : viewMode === 'my-league' ? (
            myLeagueRankings.length === 0 ? (
              <EmptyState 
                type="achievements"
                title="Sin competidores"
                description="No hay otros corredores en tu liga todavía"
              />
            ) : (
              myLeagueRankings.map((entry, index) => (
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
                    <div className="text-xs text-muted-foreground">
                      {entry.season_points || entry.total_points} puntos
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <div className="font-display font-bold text-primary">
                      {entry.season_points || entry.total_points}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      pts
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            friendsLeagues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tienes amigos aceptados aún
              </div>
            ) : (
              friendsLeagues.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    entry.id === user?.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <Avatar className="w-10 h-10 border-2 border-background flex-shrink-0" style={{ borderColor: entry.color }}>
                    <AvatarImage src={entry.avatar_url || undefined} alt={entry.username} />
                    <AvatarFallback className="text-sm font-semibold">
                      {entry.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{entry.username}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {getLeagueIcon(entry.current_league)}
                      {getLeagueName(entry.current_league)}
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <div className="font-display font-bold text-primary">
                      {entry.season_points || entry.total_points}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      pts
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
        <div className="pt-2">
          {renderTopClansCard()}
        </div>
      </Card>
    </div>
  );
};

export default Leagues;
