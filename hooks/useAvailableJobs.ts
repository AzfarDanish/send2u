import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { applyOrderChange, applyOrderDeleted, subscribeOrderChanges, subscribeOrderDeletes } from '@/lib/orderEvents';
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
  // True once any load succeeded: focus returns then refresh silently
  // instead of flashing the skeleton (the queue stays mounted behind
  // detail screens, so rows and scroll position survive).
  const hasLoaded = useRef(false);

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
      hasLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load open jobs.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // New requests appear live; taken ones drop off on reload. Queue rows are
  // RLS-visible to helpers, so the subscription is both safe and relevant.
  const silentReload = useCallback(async () => {
    try {
      const next = await listAvailableJobs();
      setJobs(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
      hasLoaded.current = true;
    } catch {
      // Keep stale data.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Preserve the visible queue on return; skeleton only when nothing
      // ever loaded (first mount, or a prior load failed).
      if (hasLoaded.current) void silentReload();
      else void load(false);
    }, [load, silentReload]),
  );

  useRealtimeReload([{ table: 'send2u_orders', event: '*' }], () => {
    void silentReload();
  });

  // Latest queue for the emitter callback (synced in an effect — refs
  // must not be written during render).
  const jobsRef = useRef<OrderWithDetails[]>([]);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // A locally-accepted job vanishes from the queue the moment the claim
  // succeeds — no waiting for the focus refetch. Rows that are still open
  // patch in place. New arrivals come through realtime, never the emitter.
  useEffect(() => {
    return subscribeOrderChanges((order) => {
      const { next } = applyOrderChange(
        jobsRef.current,
        order,
        order.status === 'pending' && !order.helperId,
      );
      setJobs(next);
    });
  }, []);

  // A deleted order (clean requester cancel before purchase, food
  // unavailable) disappears from the open queue at once.
  useEffect(() => {
    return subscribeOrderDeletes((orderId) => {
      const { next } = applyOrderDeleted(jobsRef.current, orderId);
      setJobs(next);
    });
  }, []);

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { jobs, status, error, refreshing, retry, refresh };
}
