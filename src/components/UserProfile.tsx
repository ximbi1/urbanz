import { X, Trophy, MapPin, Route, Award, User, TrendingUp, History, ShieldHalf, ShieldCheck, Loader2 } from 'lucide-react';
import { ContentSkeleton } from './ui/content-skeleton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useCallback } from 'react';
import { Run, Territory } from '@/types/territory';
import { toast } from 'sonner';
import { calculateLevel, getLevelTitle, getLevelColor } from '@/utils/levelSystem';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { RunHistory } from './RunHistory';
import { useAuth } from '@/contexts/AuthContext';

interface UserProfileProps {
  userId: string;
  onClose: () => void;
}

type DefenseTerritory = Pick<Territory, 'id' | 'tags' | 'poiSummary'>;

const SHIELD_DURATION_HOURS = 12;
const SHIELD_COST = 150;

const UserProfile = ({ userId, onClose }: UserProfileProps) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [defenseLoading, setDefenseLoading] = useState(false);
  const [defenseTerritories, setDefenseTerritories] = useState<DefenseTerritory[]>([]);
  const [userShields, setUserShields] = useState<{ consumable: number; challenge: number }>({ consumable: 0, challenge: 0 });
  const [activeShields, setActiveShields] = useState<Record<string, string>>({});
  const [applyingShield, setApplyingShield] = useState<string | null>(null);
  const [buyingShield, setBuyingShield] = useState(false);
  const levelInfo = profile ? calculateLevel(profile.total_points) : null;
  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      loadProfile();
      loadRuns();
    }
  }, [userId]);

  const loadProfile = async () => {
    try {
      // Si es propio perfil, usar tabla completa; si no, usar vista pública
      if (isOwnProfile) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        setProfile(data);
      } else {
        // Vista pública para otros usuarios (sin datos sensibles como bio, height, gender)
        const { data, error } = await supabase
          .from('profiles_public')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (error) throw error;
        setProfile(data);
      }
    } catch (error: any) {
      toast.error('Error al cargar perfil: ' + error.message);
    }
  };

  const loadRuns = async () => {
    try {
      // Si es perfil propio, usar tabla completa (con path); si no, usar vista pública (sin path GPS)
      if (isOwnProfile) {
        const { data, error } = await supabase
          .from('runs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (error) throw error;
        
        const mappedRuns: Run[] = (data || []).map(run => ({
          id: run.id,
          userId: run.user_id,
          distance: run.distance,
          duration: run.duration,
          avgPace: run.avg_pace,
          path: run.path as any,
          territoriesConquered: run.territories_conquered,
          territoriesStolen: run.territories_stolen,
          territoriesLost: run.territories_lost,
          pointsGained: run.points_gained,
          timestamp: new Date(run.created_at).getTime(),
        }));
        
        setRuns(mappedRuns);
      } else {
        // Para otros usuarios, usar vista pública (path disponible solo si is_public=true)
        const { data, error } = await supabase
          .from('runs_public')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (error) throw error;
        
        const mappedRuns: Run[] = (data || []).map(run => ({
          id: run.id,
          userId: run.user_id,
          distance: run.distance,
          duration: run.duration,
          avgPace: run.avg_pace,
          path: run.path ? (run.path as any) : [], // Path solo disponible si is_public=true
          territoriesConquered: run.territories_conquered,
          territoriesStolen: run.territories_stolen,
          territoriesLost: run.territories_lost,
          pointsGained: run.points_gained,
          timestamp: new Date(run.created_at).getTime(),
        }));
        
        setRuns(mappedRuns);
      }
    } catch (error: any) {
      toast.error('Error al cargar carreras: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDefenseData = useCallback(async () => {
    if (!isOwnProfile) return;
    setDefenseLoading(true);
    try {
      const [{ data: userShieldRows }, { data: territoryRows }, { data: shieldRows }] = await Promise.all([
        supabase.from('user_shields').select('*').eq('user_id', userId),
        supabase
          .from('territories')
          .select('id, tags, poi_summary')
          .eq('user_id', userId)
          .limit(50),
        supabase
          .from('territory_shields')
          .select('territory_id, expires_at')
          .eq('user_id', userId)
          .gt('expires_at', new Date().toISOString()),
      ]);

      const shieldTotals = { consumable: 0, challenge: 0 };
      (userShieldRows || []).forEach((row) => {
        if (row.source === 'consumable') shieldTotals.consumable += row.charges;
        if (row.source === 'challenge') shieldTotals.challenge += row.charges;
      });
      setUserShields(shieldTotals);

      const mappedTerritories: DefenseTerritory[] = (territoryRows || []).map((territory: any) => ({
        id: territory.id,
        tags: territory.tags || [],
        poiSummary: territory.poi_summary || null,
      }));
      setDefenseTerritories(mappedTerritories);

      const activeMap: Record<string, string> = {};
      (shieldRows || []).forEach((row) => {
        activeMap[row.territory_id] = row.expires_at;
      });
      setActiveShields(activeMap);
    } catch (error) {
      console.error('Defense center load error', error);
      toast.error('No se pudieron cargar tus escudos');
    } finally {
      setDefenseLoading(false);
    }
  }, [isOwnProfile, userId]);

  useEffect(() => {
    loadDefenseData();
  }, [loadDefenseData]);

  const buyShield = async () => {
    if (!isOwnProfile || !profile) return;
    const currentPoints = profile.total_points || 0;
    if (currentPoints < SHIELD_COST) {
      toast.error('Necesitas más puntos para comprar un escudo');
      return;
    }
    setBuyingShield(true);
    try {
      const updatedPoints = currentPoints - SHIELD_COST;
      const { error } = await supabase
        .from('profiles')
        .update({ total_points: updatedPoints })
        .eq('id', userId);
      if (error) throw error;

      await supabase
        .from('user_shields')
        .insert({ user_id: userId, source: 'consumable', charges: 1 });

      setProfile((prev: any) => prev ? { ...prev, total_points: updatedPoints } : prev);
      setUserShields((prev) => ({ ...prev, consumable: prev.consumable + 1 }));
      toast.success('Escudo adquirido');
    } catch (error) {
      console.error('Error comprando escudo', error);
      toast.error('No se pudo comprar el escudo');
    } finally {
      setBuyingShield(false);
    }
  };

  const applyShield = async (territoryId: string, source: 'consumable' | 'challenge') => {
    if (!isOwnProfile) return;
    if (userShields[source] <= 0) {
      toast.error('No tienes escudos disponibles de este tipo');
      return;
    }
    const applyingKey = `${territoryId}-${source}`;
    setApplyingShield(applyingKey);
    try {
      await supabase
        .from('territory_shields')
        .delete()
        .eq('territory_id', territoryId);

      const expires = new Date(Date.now() + SHIELD_DURATION_HOURS * 60 * 60 * 1000).toISOString();
      await supabase
        .from('territory_shields')
        .insert({ territory_id: territoryId, user_id: userId, shield_type: source, expires_at: expires });

      const { data } = await supabase
        .from('user_shields')
        .select('id, charges')
        .eq('user_id', userId)
        .eq('source', source)
        .order('created_at', { ascending: true })
        .limit(1);

      if (data && data[0]) {
        const newCharges = Math.max(0, data[0].charges - 1);
        await supabase
          .from('user_shields')
          .update({ charges: newCharges })
          .eq('id', data[0].id);
      }

      setUserShields((prev) => ({ ...prev, [source]: Math.max(0, prev[source] - 1) }));
      setActiveShields((prev) => ({ ...prev, [territoryId]: expires }));
      toast.success('Escudo activado');
    } catch (error) {
      console.error('Error aplicando escudo', error);
      toast.error('No se pudo activar el escudo');
    } finally {
      setApplyingShield(null);
    }
  };

  const formatShieldExpiry = (iso: string) => {
    const expires = new Date(iso);
    return expires.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const getWeeklyData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const dayRuns = runs.filter(run => 
        new Date(run.timestamp).toISOString().split('T')[0] === date
      );
      return {
        day: new Date(date).toLocaleDateString('es-ES', { weekday: 'short' }),
        distance: Math.round(dayRuns.reduce((sum, run) => sum + run.distance, 0) / 1000 * 100) / 100,
        points: dayRuns.reduce((sum, run) => sum + run.pointsGained, 0),
      };
    });
  };

  if (showRunHistory) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl bg-card border-glow p-4 md:p-6 max-h-[90vh] overflow-auto">
          <RunHistory userId={userId} onClose={() => setShowRunHistory(false)} />
        </Card>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-card border-glow p-6">
          <ContentSkeleton type="profile" />
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-card border-glow p-6 space-y-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display font-bold glow-primary">
            Perfil de Usuario
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Información del Usuario */}
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
          <div className="relative">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback>
                <User className="w-10 h-10" />
              </AvatarFallback>
            </Avatar>
            {levelInfo && (
              <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-background border-2 border-primary shadow-lg ${getLevelColor(levelInfo.level)}`}>
                <span className="font-display font-bold text-xs">Nv. {levelInfo.level}</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-display font-bold">{profile.username}</h3>
            {levelInfo && (
              <p className={`text-xs font-semibold mt-0.5 ${getLevelColor(levelInfo.level)}`}>
                {getLevelTitle(levelInfo.level)}
              </p>
            )}
            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Progreso de Nivel */}
        {levelInfo && (
          <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-foreground">Nivel {levelInfo.level}</div>
                <div className="text-xs text-muted-foreground">{profile.total_points} puntos totales</div>
              </div>
            </div>
            <Progress value={levelInfo.progressPercentage} className="h-2" />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 bg-muted/30 border-border text-center">
            <div className="flex justify-center mb-2">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <div className="text-2xl font-display font-bold text-primary">
              {profile.total_points || 0}
            </div>
            <div className="text-xs text-muted-foreground">Puntos</div>
          </Card>
          
          <Card className="p-4 bg-muted/30 border-border text-center">
            <div className="flex justify-center mb-2">
              <MapPin className="w-6 h-6 text-secondary" />
            </div>
            <div className="text-2xl font-display font-bold text-secondary">
              {profile.total_territories || 0}
            </div>
            <div className="text-xs text-muted-foreground">Territorios</div>
          </Card>
          
          <Card className="p-4 bg-muted/30 border-border text-center">
            <div className="flex justify-center mb-2">
              <Route className="w-6 h-6 text-accent" />
            </div>
            <div className="text-2xl font-display font-bold text-accent">
              {formatDistance(profile.total_distance || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Distancia</div>
          </Card>

          <Card className="p-4 bg-muted/30 border-border text-center">
            <div className="text-2xl font-display font-bold">
              {profile.current_streak || 0}🔥
            </div>
            <div className="text-xs text-muted-foreground">Días seguidos</div>
          </Card>
        </div>

        {isOwnProfile && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Centro de defensa</p>
                <h3 className="text-lg font-display font-bold">Escudos y territorios</h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={loadDefenseData}
                disabled={defenseLoading}
              >
                {defenseLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Actualizar
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="p-4 bg-card/40 border-border text-center">
                <ShieldHalf className="w-5 h-5 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Escudos comprados</p>
                <p className="text-2xl font-display font-bold">{userShields.consumable}</p>
              </Card>
              <Card className="p-4 bg-card/40 border-border text-center">
                <ShieldCheck className="w-5 h-5 mx-auto mb-2 text-secondary" />
                <p className="text-sm text-muted-foreground">Escudos por logros</p>
                <p className="text-2xl font-display font-bold">{userShields.challenge}</p>
              </Card>
              <Card className="p-4 bg-card/40 border-border text-center">
                <p className="text-sm text-muted-foreground">Puntos disponibles</p>
                <p className="text-2xl font-display font-bold">{profile.total_points || 0}</p>
                <Button
                  className="mt-2"
                  size="sm"
                  disabled={buyingShield}
                  onClick={buyShield}
                >
                  {buyingShield && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Comprar escudo (150)
                </Button>
              </Card>
            </div>
            {defenseLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Preparando tus territorios...
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {defenseTerritories.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aún no tienes territorios para proteger.</p>
                ) : (
                  defenseTerritories.map((territory) => {
                    const hasShield = Boolean(activeShields[territory.id]);
                    const label = territory.poiSummary || territory.tags?.[0]?.name;
                    return (
                      <Card key={territory.id} className="p-3 bg-card/40 border-border">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">Territorio {territory.id.slice(0, 6)}</p>
                            {label && (
                              <p className="text-xs text-primary">{label}</p>
                            )}
                            {hasShield && (
                              <p className="text-xs text-emerald-400">
                                Escudo activo hasta {formatShieldExpiry(activeShields[territory.id])}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={userShields.challenge <= 0 || hasShield || applyingShield === `${territory.id}-challenge`}
                              onClick={() => applyShield(territory.id, 'challenge')}
                            >
                              {applyingShield === `${territory.id}-challenge` && (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              )}
                              Escudo logros
                            </Button>
                            <Button
                              size="sm"
                              disabled={userShields.consumable <= 0 || hasShield || applyingShield === `${territory.id}-consumable`}
                              onClick={() => applyShield(territory.id, 'consumable')}
                            >
                              {applyingShield === `${territory.id}-consumable` && (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              )}
                              Escudo 12h
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Récords Personales */}
        {runs.length > 0 && (
          <div className="space-y-4 p-4 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-display font-bold">Récords Personales</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="p-3 bg-card/50 border-accent/30">
                <div className="text-xs text-muted-foreground mb-1">Mayor distancia</div>
                <div className="text-xl font-display font-bold text-accent">
                  {formatDistance(Math.max(...runs.map(r => r.distance)))}
                </div>
              </Card>
              <Card className="p-3 bg-card/50 border-accent/30">
                <div className="text-xs text-muted-foreground mb-1">Mejor ritmo</div>
                <div className="text-xl font-display font-bold text-accent">
                  {Math.min(...runs.map(r => r.avgPace)).toFixed(2)} min/km
                </div>
              </Card>
              <Card className="p-3 bg-card/50 border-accent/30">
                <div className="text-xs text-muted-foreground mb-1">Más territorios</div>
                <div className="text-xl font-display font-bold text-accent">
                  {Math.max(...runs.map(r => r.territoriesConquered + r.territoriesStolen))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Progreso Semanal */}
        {runs.length > 0 && (
          <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" />
              <h3 className="text-lg font-display font-bold">Últimos 7 días</h3>
            </div>
            
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={getWeeklyData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="day" 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="distance" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--secondary))' }}
                  name="Distancia (km)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Botón para ver historial completo */}
        <Button 
          onClick={() => setShowRunHistory(true)} 
          variant="secondary" 
          className="w-full"
        >
          <History className="w-4 h-4 mr-2" />
          Ver historial completo de carreras
        </Button>
      </Card>
    </div>
  );
};

export default UserProfile;
