import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getOfflineRuns,
  removeOfflineRun,
  shouldAttemptRun,
  markOfflineRunFailed,
  OfflineRunEntry,
} from '@/utils/offlineQueue';

export interface BootstrapState {
  isBootstrapping: boolean;
  syncedCount: number;
  totalPending: number;
  error: string | null;
}

/**
 * Hook that handles initial app bootstrap including offline sync.
 * Should be used at the app root level to sync before showing content.
 */
export const useAppBootstrap = () => {
  const [state, setState] = useState<BootstrapState>({
    isBootstrapping: true,
    syncedCount: 0,
    totalPending: 0,
    error: null,
  });
  const hasRun = useRef(false);

  const performInitialSync = useCallback(async () => {
    // Skip if not online
    if (!navigator.onLine) {
      setState(prev => ({ ...prev, isBootstrapping: false }));
      return;
    }

    const queue = getOfflineRuns().filter(shouldAttemptRun);
    if (queue.length === 0) {
      setState(prev => ({ ...prev, isBootstrapping: false }));
      return;
    }

    setState(prev => ({ ...prev, totalPending: queue.length }));

    try {
      const { data } = await supabase.auth.getUser();
      const currentUser = data?.user;
      
      if (!currentUser) {
        // No user logged in, can't sync
        setState(prev => ({ ...prev, isBootstrapping: false }));
        return;
      }

      let syncedCount = 0;

      for (const entry of queue) {
        if (entry.payload.userId !== currentUser.id) continue;

        try {
          const { data: claimResult, error } = await supabase.functions.invoke('process-territory-claim', {
            body: {
              path: entry.payload.path,
              duration: entry.payload.duration,
              source: entry.payload.source,
            },
          });

          if (error || !claimResult?.success) {
            markOfflineRunFailed(entry.id);
            continue;
          }

          removeOfflineRun(entry.id);
          syncedCount++;
          setState(prev => ({ ...prev, syncedCount }));
        } catch (err) {
          markOfflineRunFailed(entry.id);
          console.error('Bootstrap sync error for entry', entry.id, err);
        }
      }

      setState(prev => ({
        ...prev,
        isBootstrapping: false,
        syncedCount,
      }));
    } catch (error) {
      console.error('Bootstrap sync error', error);
      setState(prev => ({
        ...prev,
        isBootstrapping: false,
        error: 'Error al sincronizar carreras pendientes',
      }));
    }
  }, []);

  useEffect(() => {
    // Only run once on mount
    if (hasRun.current) return;
    hasRun.current = true;

    // Small delay to let splash screen show
    const timer = setTimeout(() => {
      performInitialSync();
    }, 100);

    return () => clearTimeout(timer);
  }, [performInitialSync]);

  return state;
};
