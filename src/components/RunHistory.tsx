import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Trophy, Calendar, Filter, Search, Navigation } from 'lucide-react';
import { ContentSkeleton } from './ui/content-skeleton';
import { EmptyState } from './ui/empty-state';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Run } from '@/types/territory';
import RunDetail from './RunDetail';
import { calculateDistance } from '@/utils/geoCalculations';
import { Coordinate } from '@/types/territory';

interface RunHistoryProps {
  onClose: () => void;
  userId?: string;
}

export const RunHistory = ({ onClose, userId }: RunHistoryProps) => {
  const { user } = useAuth();
  type RunWithSplits = Run & { splits?: { km: number; time: number; pace: number }[] };
  const [runs, setRuns] = useState<RunWithSplits[]>([]);
  const [filteredRuns, setFilteredRuns] = useState<RunWithSplits[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [filterDistance, setFilterDistance] = useState<string>('all');
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      loadRuns();
    }
  }, [targetUserId]);

  useEffect(() => {
    applyFilters();
  }, [runs, searchTerm, filterPeriod, filterDistance]);

  const computeSplits = (path: Coordinate[], distance: number, duration: number) => {
    if (!path || path.length < 2 || distance <= 0 || duration <= 0) return [];
    const splits: { km: number; time: number; pace: number }[] = [];
    let accumDist = 0;
    let accumTime = 0;
    let kmCounter = 1;
    for (let i = 1; i < path.length; i++) {
      const segDist = calculateDistance(path[i - 1], path[i]);
      accumDist += segDist;
      const segTime = duration * (segDist / Math.max(distance, 1));
      accumTime += segTime;
      while (accumDist >= kmCounter * 1000 && distance > 0) {
        const overshoot = accumDist - kmCounter * 1000;
        const pace = ((accumTime - overshoot * (duration / Math.max(distance, 1))) / 60);
        splits.push({ km: kmCounter, time: accumTime, pace });
        kmCounter++;
      }
    }
    return splits;
  };

  const loadRuns = async () => {
    if (!targetUserId) {
      console.error('RunHistory: No targetUserId provided');
      return;
    }
    
    const isOwnHistory = targetUserId === user?.id;
    console.log('RunHistory: Loading runs for user', targetUserId, 'isOwn:', isOwnHistory);
    setLoading(true);
    try {
      // Si es historial propio, usar tabla completa; si no, usar vista pública (sin path GPS)
      if (isOwnHistory) {
        const { data, error } = await supabase
          .from('runs')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false });
        
        console.log('RunHistory: Loaded runs', { count: data?.length, error });
        
        if (error) throw error;
        
        const mappedRuns: RunWithSplits[] = (data || []).map(run => ({
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
          splits: [],
        }));
        
        setRuns(mappedRuns);
      } else {
        // Para otros usuarios, usar vista pública sin datos GPS sensibles
        const { data, error } = await supabase
          .from('runs_public')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false });
        
        console.log('RunHistory: Loaded runs (public)', { count: data?.length, error });
        
        if (error) throw error;
        
        const mappedRuns: RunWithSplits[] = (data || []).map(run => ({
          id: run.id,
          userId: run.user_id,
          distance: run.distance,
          duration: run.duration,
          avgPace: run.avg_pace,
          path: [], // No path disponible para otros usuarios
          territoriesConquered: run.territories_conquered,
          territoriesStolen: run.territories_stolen,
          territoriesLost: run.territories_lost,
          pointsGained: run.points_gained,
          timestamp: new Date(run.created_at).getTime(),
          splits: [],
        }));
        
        setRuns(mappedRuns);
      }
    } catch (error: any) {
      console.error('RunHistory: Error loading runs', error);
      toast.error('Error al cargar carreras: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...runs];

    // Filtro por período
    if (filterPeriod !== 'all') {
      const now = Date.now();
      const periods: Record<string, number> = {
        'week': 7 * 24 * 60 * 60 * 1000,
        'month': 30 * 24 * 60 * 60 * 1000,
        '3months': 90 * 24 * 60 * 60 * 1000,
      };
      filtered = filtered.filter(run => now - run.timestamp < periods[filterPeriod]);
    }

    // Filtro por distancia
    if (filterDistance !== 'all') {
      const distances: Record<string, [number, number]> = {
        'short': [0, 5000],
        'medium': [5000, 10000],
        'long': [10000, Infinity],
      };
      const [min, max] = distances[filterDistance];
      filtered = filtered.filter(run => run.distance >= min && run.distance < max);
    }

    // Búsqueda por fecha
    if (searchTerm) {
      filtered = filtered.filter(run => 
        new Date(run.timestamp).toLocaleDateString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredRuns(filtered.map(run => ({
      ...run,
      splits: computeSplits((run.path as Coordinate[]) || [], run.distance, run.duration),
    })));
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (pace: number) => {
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  if (selectedRun) {
    return <RunDetail run={selectedRun} onClose={() => setSelectedRun(null)} />;
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-background">
      <div className="container mx-auto px-4 py-6 space-y-4 max-w-4xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-2xl font-display font-bold glow-primary">
            Historial de Carreras
          </h2>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por fecha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger>
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fechas</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
              <SelectItem value="3months">Últimos 3 meses</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterDistance} onValueChange={setFilterDistance}>
            <SelectTrigger>
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Distancia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las distancias</SelectItem>
              <SelectItem value="short">Corta (&lt;5km)</SelectItem>
              <SelectItem value="medium">Media (5-10km)</SelectItem>
              <SelectItem value="long">Larga (&gt;10km)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Estadísticas generales */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 bg-muted/30 border-border text-center">
            <div className="text-2xl font-display font-bold text-primary">
              {filteredRuns.length}
            </div>
            <div className="text-xs text-muted-foreground">Carreras</div>
          </Card>
          <Card className="p-3 bg-muted/30 border-border text-center">
            <div className="text-2xl font-display font-bold text-secondary">
              {(filteredRuns.reduce((sum, r) => sum + r.distance, 0) / 1000).toFixed(1)} km
            </div>
            <div className="text-xs text-muted-foreground">Distancia total</div>
          </Card>
          <Card className="p-3 bg-muted/30 border-border text-center">
            <div className="text-2xl font-display font-bold text-accent">
              {filteredRuns.reduce((sum, r) => sum + r.territoriesConquered + r.territoriesStolen, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Territorios</div>
          </Card>
        </div>

        {/* Lista de carreras */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <ContentSkeleton type="runs" count={4} />
          ) : filteredRuns.length === 0 ? (
            <EmptyState 
              type="runs" 
              title={searchTerm || filterPeriod !== 'all' || filterDistance !== 'all' 
                ? 'No se encontraron carreras' 
                : undefined}
              description={searchTerm || filterPeriod !== 'all' || filterDistance !== 'all'
                ? 'Prueba con otros filtros de búsqueda'
                : undefined}
            />
          ) : (
            filteredRuns.map((run) => (
              <Card
                key={run.id}
                className="p-4 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => setSelectedRun(run)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{formatDate(run.timestamp)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground text-xs">Distancia</div>
                        <div className="font-semibold">{(run.distance / 1000).toFixed(2)} km</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Tiempo</div>
                        <div className="font-semibold">{formatDuration(run.duration)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Ritmo</div>
                        <div className="font-semibold">{run.avgPace.toFixed(2)} min/km</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Puntos</div>
                        <div className="font-semibold text-primary">+{run.pointsGained}</div>
                      </div>
                    </div>

                    {(run.territoriesConquered > 0 || run.territoriesStolen > 0) && (
                      <div className="flex items-center gap-3 text-xs">
                        {run.territoriesConquered > 0 && (
                          <div className="flex items-center gap-1 text-green-500">
                            <MapPin className="h-3 w-3" />
                            {run.territoriesConquered} conquistados
                          </div>
                        )}
                        {run.territoriesStolen > 0 && (
                          <div className="flex items-center gap-1 text-orange-500">
                            <Trophy className="h-3 w-3" />
                            {run.territoriesStolen} robados
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                  
                  <Button variant="ghost" size="sm">
                    Ver detalles →
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
