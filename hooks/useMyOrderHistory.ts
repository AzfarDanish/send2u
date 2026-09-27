import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { applyOrderChange, subscribeOrderChanges } from '@/lib/orderEvents';
import { isTerminalOrderStatus } from '@/lib/orders';
import { listMyOrderHistory } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

export type MyOrderHistoryStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseMyOrderHistoryResult {
  orders: OrderWithDetails[];
  status: MyOrderHistoryStatus;
  error: string | null;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
}

/**
 * Requester's terminal orders (completed/cancelled/disputed), newest first.
 * Read-only records — the query itself excludes every active status, so
 * terminal orders can never leak into the Active list and vice versa.
 *
 * Pass `enabled={false}` while the history UI is hidden (e.g. the Active
 * tab is showing) to skip the mount fetch; the query runs on the first
 * flip to `true`. Defaults to `true` to preserve the plain mount-load.
 * Screen focus refetches silently once anything loaded, so returning from
 * a detail never shows a stale record.
 */
export function useMyOrderHistory(enabled = true): UseMyOrderHistoryResult {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [status, setStatus] = useState<MyOrderHistoryStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // True once any load succeeded: later tab revisits refresh silently
  // instead of flashing the skeleton over visible history.
  const hasLoaded = useRef(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setStatus('loading');
    }
    setError(null);
    try {
      const next = await listMyOrderHistory();
      setOrders(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
      hasLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your order history.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Preserving background refetch for membership changes (a cancelled
  // order newly belongs here) and realtime-less reconciliation. Never
  // blanks; failures keep stale rows.
  const silentReload = useCallback(async () => {
    try {
      const next = await listMyOrderHistory();
      setOrders(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
      hasLoaded.current = true;
    } catch {
      // Keep stale data.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (hasLoaded.current) void silentReload();
    else void load(false);
  }, [enabled, load, silentReload]);

  // Screen revisits (back from a detail, tab return) refetch silently once
  // something loaded before. Kept alongside the enabled effect above, which
  // covers hidden-tab flips that fire no focus event; the service dedupes
  // concurrent loads to a single request.
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      if (hasLoaded.current) void silentReload();
      else void load(false);
    }, [enabled, load, silentReload]),
  );

  // Latest list + enabled flag for the emitter callback (synced in an
  // effect — refs must not be written during render).
  const ordersRef = useRef<OrderWithDetails[]>([]);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    ordersRef.current = orders;
    enabledRef.current = enabled;
  }, [orders, enabled]);

  // A locally-mutated order that just turned terminal (detail cancel /
  // dispute) appears here without waiting for a tab revisit; rows that
  // somehow left the bucket are dropped. Membership entries refetch
  // silently since one record can't determine list ordering — skipped
  // while hidden (the enabled-flip load covers the next visit).
  useEffect(() => {
    return subscribeOrderChanges((order) => {
      const { next, needsRefetch } = applyOrderChange(
        ordersRef.current,
        order,
        isTerminalOrderStatus(order.status),
      );
      if (needsRefetch) {
        if (enabledRef.current) void silentReload();
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
