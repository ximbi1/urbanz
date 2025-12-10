import { Trophy, MapPin, Timer, TrendingUp, Zap, Activity, Flame, Gauge, Share2, Navigation } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ShareConquest } from './ShareConquest';
import { useState } from 'react';
import { Run } from '@/types/territory';
import { Coordinate } from '@/types/territory';
import { calculateDistance } from '@/utils/geoCalculations';

interface RunSummaryProps {
  conquered: number;
  stolen: number;
  lost: number;
  pointsGained: number;
  distance: number;
  duration: number;
  avgPace: number;
  avgSpeed: number;
  onClose: () => void;
  path?: Coordinate[];
}

const RunSummary = ({
  conquered,
  stolen,
  lost,
  pointsGained,
  distance,
  duration,
  avgPace,
  avgSpeed,
  path,
  onClose,
}: RunSummaryProps) => {
  const [showShare, setShowShare] = useState(false);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatPace = (pace: number) => {
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateCalories = () => {
    // Estimación aproximada: 0.75 calorías por kg de peso por km
    // Asumiendo peso promedio de 70kg
    const weightKg = 70;
    const distanceKm = distance / 1000;
    return Math.round(distanceKm * weightKg * 0.75);
  };

  const computeSplits = (pathCoords: Coordinate[]) => {
    if (!path || path.length < 2) return [];
    const splits: { km: number; time: number; pace: number }[] = [];
    let accumDist = 0;
    let accumTime = 0;
    let kmCounter = 1;
    for (let i = 1; i < path.length; i++) {
      const segDist = calculateDistance(pathCoords[i - 1], pathCoords[i]);
      accumDist += segDist;
      // Repartir tiempo proporcional al tramo respecto a distancia total
      const segTime = duration * (segDist / Math.max(distance, 1));
      accumTime += segTime;
      while (accumDist >= kmCounter * 1000 && distance > 0) {
        const overshoot = accumDist - kmCounter * 1000;
        const ratio = segDist > 0 ? (segDist - overshoot) / segDist : 0;
        const splitTime = accumTime - overshoot * (duration / Math.max(distance, 1));
        const pace = (splitTime / 60) / 1; // min/km
        splits.push({ km: kmCounter, time: splitTime, pace });
        kmCounter++;
      }
    }
    return splits;
  };

  const splits = computeSplits(path || []);

  // Crear objeto Run para compartir
  const runData: Run = {
    id: Date.now().toString(),
    userId: '',
    distance,
    duration,
    avgPace,
    path: path || [],
    territoriesConquered: conquered,
    territoriesStolen: stolen,
    territoriesLost: lost,
    pointsGained,
    timestamp: Date.now(),
  };

  if (showShare) {
    return <ShareConquest run={runData} onClose={() => setShowShare(false)} />;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-lg bg-card border-glow p-6 space-y-5 my-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent mb-4 border-glow animate-pulse">
            <Trophy className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-display font-bold glow-primary mb-2">
            ¡Carrera Completada!
          </h2>
          <p className="text-muted-foreground">
            Has ganado <span className="text-primary font-bold">{pointsGained}</span> puntos
          </p>
        </div>

        {/* Territorios */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Territorios
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 bg-success/10 border-success/30">
              <div className="text-xs text-muted-foreground mb-1">Conquistados</div>
              <div className="text-2xl font-display font-bold text-success">{conquered}</div>
            </Card>
            <Card className="p-3 bg-accent/10 border-accent/30">
              <div className="text-xs text-muted-foreground mb-1">Robados</div>
              <div className="text-2xl font-display font-bold text-accent">{stolen}</div>
            </Card>
            {lost > 0 && (
              <Card className="p-3 bg-destructive/10 border-destructive/30">
                <div className="text-xs text-muted-foreground mb-1">Perdidos</div>
                <div className="text-2xl font-display font-bold text-destructive">{lost}</div>
              </Card>
            )}
          </div>
        </div>

        <Separator />

        {/* Parciales por km */}
        {splits.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              Parciales (cada km)
            </h3>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {splits.map((split) => (
                <Card key={split.km} className="p-3 bg-muted/20 border-border text-sm flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Km {split.km}</div>
                    <div className="text-muted-foreground text-xs">Pace: {formatPace(split.pace)}</div>
                  </div>
                  <div className="font-semibold">{formatTime(Math.round(split.time))}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Estadísticas principales */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Rendimiento
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-muted/30 border-border">
              <div className="flex items-center gap-2 mb-2">
                <Timer className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Tiempo</span>
              </div>
              <div className="text-xl font-display font-bold">{formatTime(duration)}</div>
            </Card>

            <Card className="p-4 bg-muted/30 border-border">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-secondary" />
                <span className="text-xs text-muted-foreground">Distancia</span>
              </div>
              <div className="text-xl font-display font-bold">{formatDistance(distance)}</div>
            </Card>

            <Card className="p-4 bg-muted/30 border-border">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-accent" />
                <span className="text-xs text-muted-foreground">Ritmo Promedio</span>
              </div>
              <div className="text-xl font-display font-bold">
                {formatPace(avgPace)} <span className="text-sm font-normal text-muted-foreground">min/km</span>
              </div>
            </Card>

            <Card className="p-4 bg-muted/30 border-border">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Velocidad Prom.</span>
              </div>
              <div className="text-xl font-display font-bold">
                {avgSpeed.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">km/h</span>
              </div>
            </Card>
          </div>
        </div>

        <Separator />

        {/* Estadísticas adicionales */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4" />
            Otros
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-muted/30 border-border">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-warning" />
                <span className="text-xs text-muted-foreground">Calorías</span>
              </div>
              <div className="text-xl font-display font-bold text-warning">
                ~{calculateCalories()} <span className="text-sm font-normal text-muted-foreground">kcal</span>
              </div>
            </Card>

            <Card className="p-4 bg-muted/30 border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-xs text-muted-foreground">Ritmo</span>
              </div>
              <div className="text-sm font-semibold">
                {avgPace < 5 ? '⚡ Muy rápido' : avgPace < 6 ? '🏃 Rápido' : avgPace < 7 ? '👟 Moderado' : '🚶 Tranquilo'}
              </div>
            </Card>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setShowShare(true)} variant="outline" className="flex-1">
            <Share2 className="h-4 w-4 mr-2" />
            Compartir
          </Button>
          <Button onClick={onClose} className="flex-1 h-12 bg-primary hover:bg-primary/90">
            Continuar
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default RunSummary;
