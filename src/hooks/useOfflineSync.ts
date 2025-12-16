import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  getOfflineRuns,
  removeOfflineRun,
  subscribeOfflineQueue,
  OfflineRunEntry,
  markOfflineRunFailed,
  shouldAttemptRun,
} from '@/utils/offlineQueue';

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

export const useOfflineSync = () => {
  const [pendingRuns, setPendingRuns] = useState<OfflineRunEntry[]>(() => getOfflineRuns());
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueue = useCallback(() => {
    setPendingRuns(getOfflineRuns());
  }, []);

  const syncRuns = useCallback(async () => {
    if (isSyncing) return;
    if (!navigator.onLine) return;
    const queue = getOfflineRuns().filter(shouldAttemptRun);
    if (!queue.length) {
      refreshQueue();
      return;
    }

    setIsSyncing(true);
    try {
      const { data } = await supabase.auth.getUser();
      const currentUser = data?.user;
      if (!currentUser) {
        toast.error('Inicia sesión para sincronizar tus carreras offline');
        return;
      }

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
            const message = error?.message || (claimResult as any)?.error || 'No se pudo sincronizar';
            markOfflineRunFailed(entry.id);
            toast.error('Error al sincronizar carrera', { description: message });
            continue;
          }

          removeOfflineRun(entry.id);
          refreshQueue();
          toast.success('Carrera sincronizada', {
            description: `${formatDistance(entry.metadata.distance)} · ${new Date(entry.metadata.createdAt).toLocaleString('es-ES')}`,
          });
        } catch (error: any) {
          markOfflineRunFailed(entry.id);
          console.error('Offline sync error', error);
          toast.error('Error al sincronizar carrera', {
            description: error?.message || 'Inténtalo nuevamente más tarde',
          });
        }
      }
    } catch (error) {
      console.error('Offline sync error', error);
      toast.error('Error al sincronizar carreras offline');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshQueue]);

  useEffect(() => {
    if (navigator.onLine) {
      syncRuns();
    }
  }, [syncRuns]);

  useEffect(() => {
    const unsubscribe = subscribeOfflineQueue(refreshQueue);
    const handleOnline = () => {
      refreshQueue();
      syncRuns();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
  }, [refreshQueue, syncRuns]);

  return {
    pendingRuns,
    pendingRunsCount: pendingRuns.length,
    isSyncing,
    syncRuns,
  };
};
