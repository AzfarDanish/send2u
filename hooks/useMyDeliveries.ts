import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { listMyDeliveries } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

export type DeliveriesStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseMyDeliveriesResult {
  deliveries: OrderWithDetails[];
  status: DeliveriesStatus;
  error: string | null;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
}

/**
 * Orders assigned to the signed-in helper. Refetches on screen focus so a
 * just-accepted job appears without manual refresh.
 */
export function useMyDeliveries(): UseMyDeliveriesResult {
  const [deliveries, setDeliveries] = useState<OrderWithDetails[]>([]);
  const [status, setStatus] = useState<DeliveriesStatus>('loading');
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
      const next = await listMyDeliveries();
      setDeliveries(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your deliveries.');
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

  // Live updates (requester confirms, pays, cancels…). RLS-scoped; silent on
  // failure so the focus/refresh paths stay the source of truth.
  const silentReload = useCallback(async () => {
    try {
      const next = await listMyDeliveries();
      setDeliveries(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch {
      // Keep stale data.
    }
  }, []);

  useRealtimeReload([{ table: 'send2u_orders', event: '*' }], () => {
    void silentReload();
  });

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { deliveries, status, error, refreshing, retry, refresh };
}
