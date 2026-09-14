import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { applyOrderChange, subscribeOrderChanges } from '@/lib/orderEvents';
import { isTerminalOrderStatus } from '@/lib/orders';
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
  // True once any load succeeded: focus returns then refresh silently
  // instead of flashing the skeleton (rows and scroll position survive).
  const hasLoaded = useRef(false);

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
      hasLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your deliveries.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Live updates (requester confirms, pays, cancels…). RLS-scoped; silent on
  // failure so the focus/refresh paths stay the source of truth.
  const silentReload = useCallback(async () => {
    try {
      const next = await listMyDeliveries();
      setDeliveries(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
      hasLoaded.current = true;
    } catch {
      // Keep stale data.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Preserve the visible list on return; skeleton only when nothing
      // ever loaded (first mount, or a prior load failed).
      if (hasLoaded.current) void silentReload();
      else void load(false);
    }, [load, silentReload]),
  );

  useRealtimeReload([{ table: 'send2u_orders', event: '*' }], () => {
    void silentReload();
  });

  // Latest list for the emitter callback (synced in an effect — refs must
  // not be written during render).
  const deliveriesRef = useRef<OrderWithDetails[]>([]);
  useEffect(() => {
    deliveriesRef.current = deliveries;
  }, [deliveries]);

  // Local advances patch the affected card in place; terminal moves drop
  // the row; a newly-accepted job (absent here) triggers the preserving
  // silent refetch since one record can't determine list ordering.
  useEffect(() => {
    return subscribeOrderChanges((order) => {
      const { next, needsRefetch } = applyOrderChange(
        deliveriesRef.current,
        order,
        !isTerminalOrderStatus(order.status),
      );
      if (needsRefetch) {
        void silentReload();
        return;
      }
      setDeliveries(next);
    });
  }, [silentReload]);

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { deliveries, status, error, refreshing, retry, refresh };
}
