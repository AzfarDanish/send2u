import { useCallback, useEffect, useRef, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { applyOrderChange, subscribeOrderChanges } from '@/lib/orderEvents';
import { advancePreparation, listVendorOrders, type VendorPrepAction } from '@/services/vendor';
import type { OrderWithDetails } from '@/types/domain';

export type VendorOrdersStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseVendorOrdersResult {
  orders: OrderWithDetails[];
  status: VendorOrdersStatus;
  error: string | null;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
  advancing: string | null;
  advanceError: string | null;
  advance: (orderId: string, action: VendorPrepAction) => Promise<void>;
  dismissAdvanceError: () => void;
}

/**
 * The signed-in vendor's own stall orders — the prep queue. Reloads live on
 * order changes (RLS-scoped) and on pull-to-refresh. Preparation advances
 * optimistically patch and roll back on failure.
 */
export function useVendorOrders(): UseVendorOrdersResult {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [status, setStatus] = useState<VendorOrdersStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const ordersRef = useRef<OrderWithDetails[]>([]);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setStatus('loading');
    }
    setError(null);
    try {
      const next = await listVendorOrders();
      setOrders(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load stall orders.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const silentReload = useCallback(async () => {
    try {
      const next = await listVendorOrders();
      setOrders(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch {
      // Keep stale rows on background failure.
    }
  }, []);

  useRealtimeReload([{ table: 'send2u_orders' }], () => {
    void silentReload();
  });

  useEffect(
    () =>
      subscribeOrderChanges((order) => {
        const { next, needsRefetch } = applyOrderChange(ordersRef.current, order, true);
        if (needsRefetch) {
          void silentReload();
          return;
        }
        setOrders(next);
      }),
    [silentReload],
  );

  const advance = useCallback(
    async (orderId: string, action: VendorPrepAction) => {
      if (advancing) return;
      const previous = ordersRef.current;
      setAdvancing(orderId);
      setAdvanceError(null);
      try {
        const nextStatus = await advancePreparation(orderId, action);
        setOrders((current) =>
          current.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order)),
        );
      } catch (err) {
        setOrders(previous);
        setAdvanceError(err instanceof Error ? err.message : 'Could not update preparation.');
      } finally {
        setAdvancing(null);
      }
    },
    [advancing],
  );

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const dismissAdvanceError = useCallback(() => {
    setAdvanceError(null);
  }, []);

  return {
    orders,
    status,
    error,
    refreshing,
    retry,
    refresh,
    advancing,
    advanceError,
    advance,
    dismissAdvanceError,
  };
}
