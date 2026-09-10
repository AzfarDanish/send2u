import { useCallback, useEffect, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { listMyOrders } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

export type MyOrdersStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseMyOrdersResult {
  orders: OrderWithDetails[];
  status: MyOrdersStatus;
  error: string | null;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
}

/**
 * Requester's own orders, newest first. Loads once on mount; refresh is
 * explicit (pull-to-refresh / retry) so re-renders never refetch.
 */
export function useMyOrders(): UseMyOrdersResult {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [status, setStatus] = useState<MyOrdersStatus>('loading');
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
      const next = await listMyOrders();
      setOrders(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your orders.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  // Live updates (helper accepts, fulfilment advances, payment reviews…).
  // RLS-scoped server-side: only own rows ever arrive. Silent failures keep
  // stale data; explicit refresh/retry surfaces errors.
  const silentReload = useCallback(async () => {
    try {
      const next = await listMyOrders();
      setOrders(next);
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

  return { orders, status, error, refreshing, retry, refresh };
}
