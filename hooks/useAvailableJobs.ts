import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listAvailableJobs } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

export type JobsStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseAvailableJobsResult {
  jobs: OrderWithDetails[];
  status: JobsStatus;
  error: string | null;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
}

/**
 * Open helper job queue (pending unassigned orders, oldest first).
 * Refetches on screen focus so returning from a detail never shows a stale
 * queue; manual refresh stays available. Accepted jobs disappear on reload.
 */
export function useAvailableJobs(): UseAvailableJobsResult {
  const [jobs, setJobs] = useState<OrderWithDetails[]>([]);
  const [status, setStatus] = useState<JobsStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setStatus('loading');
    }
    setError(null);
    try {
      const next = await listAvailableJobs();
      setJobs(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load open jobs.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { jobs, status, error, refreshing, retry, refresh };
}
