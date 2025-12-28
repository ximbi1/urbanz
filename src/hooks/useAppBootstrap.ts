import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  getOfflineRuns,
  removeOfflineRun,
  shouldAttemptRun,
  markOfflineRunFailed,
} from '@/utils/offlineQueue';

export type BootstrapPhase = 'init' | 'syncing' | 'refreshing' | 'done';

export interface BootstrapState {
  isBootstrapping: boolean;
  phase: BootstrapPhase;
  syncedCount: number;
  totalPending: number;
  error: string | null;
}

/**
 * Hook that handles initial app bootstrap:
 * 1. Syncs offline runs
 * 2. Prefetches fresh data (territories, runs, profiles)
 */
export const useAppBootstrap = () => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<BootstrapState>({
    isBootstrapping: true,
    phase: 'init',
    syncedCount: 0,
    totalPending: 0,
    error: null,
  });
  const hasRun = useRef(false);

  const prefetchData = useCallback(async () => {
    if (!navigator.onLine) return;

    setState(prev => ({ ...prev, phase: 'refreshing' }));

    try {
      // Prefetch territories (main map data)
      await queryClient.prefetchQuery({
        queryKey: ['territories'],
        queryFn: async () => {
          const { data } = await supabase
            .from('territories')
            .select('*')
            .order('created_at', { ascending: false });
          return data ?? [];
        },
        staleTime: 0, // Force fresh data
      });

      // Prefetch recent runs for activity feed
      await queryClient.prefetchQuery({
        queryKey: ['recent-runs'],
        queryFn: async () => {
          const { data } = await supabase
            .from('runs')
            .select('*, profiles:user_id(username, avatar_url, color)')
            .order('created_at', { ascending: false })
            .limit(50);
          return data ?? [];
        },
        staleTime: 0,
      });

      // Prefetch user profile if logged in
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await queryClient.prefetchQuery({
          queryKey: ['profile', userData.user.id],
          queryFn: async () => {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userData.user.id)
              .single();
            return data;
          },
          staleTime: 0,
        });
      }
    } catch (error) {
      console.error('Prefetch error:', error);
      // Non-blocking - app can still load
    }
  }, [queryClient]);

  const performInitialSync = useCallback(async () => {
    // Skip if not online - just finish bootstrap
    if (!navigator.onLine) {
      setState(prev => ({ ...prev, isBootstrapping: false, phase: 'done' }));
      return;
    }

    const queue = getOfflineRuns().filter(shouldAttemptRun);
    
    // If no pending runs, go straight to prefetch
    if (queue.length === 0) {
      await prefetchData();
      setState(prev => ({ ...prev, isBootstrapping: false, phase: 'done' }));
      return;
    }

    setState(prev => ({ ...prev, phase: 'syncing', totalPending: queue.length }));

    try {
      const { data } = await supabase.auth.getUser();
      const currentUser = data?.user;
      
      if (!currentUser) {
        await prefetchData();
        setState(prev => ({ ...prev, isBootstrapping: false, phase: 'done' }));
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

      // After syncing, prefetch fresh data
      await prefetchData();

      setState(prev => ({
        ...prev,
        isBootstrapping: false,
        phase: 'done',
        syncedCount,
      }));
    } catch (error) {
      console.error('Bootstrap sync error', error);
      // Still try to prefetch even on error
      await prefetchData();
      setState(prev => ({
        ...prev,
        isBootstrapping: false,
        phase: 'done',
        error: 'Error al sincronizar carreras pendientes',
      }));
    }
  }, [prefetchData]);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const timer = setTimeout(() => {
      performInitialSync();
    }, 100);

    return () => clearTimeout(timer);
  }, [performInitialSync]);

  return state;
};
