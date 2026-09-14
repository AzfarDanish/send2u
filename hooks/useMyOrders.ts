import { useCallback, useEffect, useRef, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { applyOrderChange, subscribeOrderChanges } from '@/lib/orderEvents';
import { isTerminalOrderStatus } from '@/lib/orders';
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

  // Latest list for the emitter callback below (synced in an effect —
  // refs must not be written during render). Lets the subscription stay
  // stable across renders instead of resubscribing per list change.
  const ordersRef = useRef<OrderWithDetails[]>([]);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Local mutations (detail cancel/confirm/dispute…) patch the affected
  // card in place: rows that left for history are dropped, rows that stay
  // are patched, and only a newly-entered row triggers the preserving
  // silent refetch (membership can't be derived from one record).
  useEffect(() => {
    return subscribeOrderChanges((order) => {
      const { next, needsRefetch } = applyOrderChange(
        ordersRef.current,
        order,
        !isTerminalOrderStatus(order.status),
      );
      if (needsRefetch) {
        void silentReload();
        return;
      }
      setOrders(next);
    });
  }, [silentReload]);

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { orders, status, error, refreshing, retry, refresh };
}
