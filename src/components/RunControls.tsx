import { Play, Pause, Square, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface RunControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  duration: number;
  distance: number;
  useGPS: boolean;
  onStart: (gpsMode: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const RunControls = ({
  isRunning,
  isPaused,
  duration,
  distance,
  useGPS,
  onStart,
  onPause,
  onResume,
  onStop,
}: RunControlsProps) => {
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

  return (
    <Card className="fixed bottom-36 md:bottom-20 xl:bottom-6 left-1/2 -translate-x-1/2 p-3 md:p-4 bg-card/95 backdrop-blur-sm border-glow z-[60] w-[95vw] md:w-auto shadow-xl">
      <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap md:flex-nowrap">
        {!isRunning ? (
          <>
            <Button
              onClick={() => onStart(false)}
              className="hidden bg-primary hover:bg-primary/90 h-12 md:h-10 px-6 md:px-4 text-base md:text-sm flex-1 md:flex-none"
            >
              <Play className="w-5 h-5 md:w-4 md:h-4 mr-2" />
              Simular
            </Button>
            <Button
              onClick={() => onStart(true)}
              variant="secondary"
              className="bg-secondary hover:bg-secondary/90 h-12 md:h-10 px-6 md:px-4 text-base md:text-sm flex-1 md:flex-none"
            >
              <Navigation className="w-5 h-5 md:w-4 md:h-4 mr-2" />
              Iniciar carrera
            </Button>
          </>
        ) : (
          <>
            <div className="text-sm font-mono space-y-1 min-w-[100px]">
              <div className="text-xl md:text-xl font-display font-bold glow-primary">
                {formatTime(duration)}
              </div>
              <div className="text-muted-foreground text-sm">
                {formatDistance(distance)}
              </div>
            </div>
            
            <div className="h-8 w-px bg-border hidden md:block" />
            
            {isPaused ? (
              <Button
                onClick={onResume}
                size="icon"
                className="bg-success hover:bg-success/90 h-12 w-12 md:h-10 md:w-10"
              >
                <Play className="w-5 h-5 md:w-4 md:h-4" />
              </Button>
            ) : (
              <Button
                onClick={onPause}
                size="icon"
                variant="secondary"
                className="h-12 w-12 md:h-10 md:w-10"
              >
                <Pause className="w-5 h-5 md:w-4 md:h-4" />
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-12 w-12 md:h-10 md:w-10"
                >
                  <Square className="w-5 h-5 md:w-4 md:h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Terminar carrera?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se guardará tu carrera con {formatDistance(distance)} recorridos en {formatTime(duration)}.
                    Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onStop}>
                    Terminar carrera
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            {useGPS && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                GPS
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
};

export default RunControls;
