import { useRunPrediction } from '@/hooks/useRunPrediction';
import { Coordinate } from '@/types/territory';
import { Card } from './ui/card';
import { AlertCircle, CheckCircle, TrendingUp, MapPin } from 'lucide-react';

interface RunPredictionOverlayProps {
  runPath: Coordinate[];
  currentLocation: Coordinate | null;
  isRunning: boolean;
}

export const RunPredictionOverlay = ({
  runPath,
  currentLocation,
  isRunning,
}: RunPredictionOverlayProps) => {
  const prediction = useRunPrediction(runPath, currentLocation, isRunning);

  if (!isRunning || runPath.length < 2) {
    return null;
  }

  const getSpeedColor = () => {
    if (prediction.speedStatus === 'valid') return 'text-green-500';
    if (prediction.speedStatus === 'too_slow') return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSpeedIcon = () => {
    if (prediction.speedStatus === 'valid') return <CheckCircle className="h-5 w-5" />;
    return <AlertCircle className="h-5 w-5" />;
  };

  const getSpeedText = () => {
    if (prediction.speedStatus === 'valid') return 'Velocidad válida';
    if (prediction.speedStatus === 'too_slow') return 'Muy lento';
    return 'Muy rápido';
  };

  return (
    <div className="absolute top-24 md:top-6 left-4 right-4 z-20 pointer-events-none">
      <Card className="p-4 bg-background/95 backdrop-blur-sm pointer-events-auto">
        <div className="space-y-3">
          {/* Estado de velocidad */}
          <div className={`flex items-center gap-2 ${getSpeedColor()}`}>
            {getSpeedIcon()}
            <span className="font-semibold">{getSpeedText()}</span>
          </div>

          {/* Área predicha */}
          {prediction.predictedArea > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Área predicha:</span>
              <span className="font-semibold">
                {(prediction.predictedArea / 1000).toFixed(1)} km²
              </span>
            </div>
          )}

          {/* Distancia para cerrar */}
          {runPath.length >= 3 && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Distancia al inicio:</span>
              <span className="font-semibold">
                {prediction.distanceToClose.toFixed(0)} m
              </span>
            </div>
          )}

          {/* Sugerencia */}
          {prediction.suggestedDirection === 'close' && prediction.isCloseable && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-sm">
              <p className="text-green-600 dark:text-green-400 font-medium">
                ✓ Puedes cerrar el polígono ahora
              </p>
            </div>
          )}

          {prediction.suggestedDirection === 'continue' && !prediction.isCloseable && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-sm">
              <p className="text-blue-600 dark:text-blue-400">
                Sigue corriendo para conquistar más área
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
