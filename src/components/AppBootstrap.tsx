import { memo, ReactNode } from 'react';
import { useAppBootstrap, BootstrapState } from '@/hooks/useAppBootstrap';

interface AppBootstrapProps {
  children: ReactNode;
}

const SplashScreen = memo(({ state }: { state: BootstrapState }) => {
  const hasPending = state.totalPending > 0;
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <span className="text-2xl font-display font-bold text-primary-foreground">U</span>
          </div>
        </div>
        
        {hasPending ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-muted-foreground">Sincronizando carreras...</p>
            <p className="text-sm text-muted-foreground/70">
              {state.syncedCount} / {state.totalPending}
            </p>
            <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${(state.syncedCount / state.totalPending) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground animate-pulse">Cargando URBANZ...</p>
        )}
      </div>
    </div>
  );
});
SplashScreen.displayName = 'SplashScreen';

/**
 * Wrapper component that handles app initialization and offline sync
 * before showing the main content.
 */
export const AppBootstrap = memo(({ children }: AppBootstrapProps) => {
  const state = useAppBootstrap();

  if (state.isBootstrapping) {
    return <SplashScreen state={state} />;
  }

  return <>{children}</>;
});
AppBootstrap.displayName = 'AppBootstrap';
