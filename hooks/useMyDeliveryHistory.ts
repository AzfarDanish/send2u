import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { applyOrderChange, subscribeOrderChanges } from '@/lib/orderEvents';
import { isTerminalOrderStatus } from '@/lib/orders';
import { listMyDeliveryHistory } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

export type DeliveryHistoryStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseMyDeliveryHistoryResult {
  deliveries: OrderWithDetails[];
  status: DeliveryHistoryStatus;
  error: string | null;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
}

/**
 * Helper's terminal deliveries (completed/cancelled/disputed), newest
 * accepted first. Read-only records — refetches on focus while visible so
 * a just-closed job appears without manual refresh.
 *
 * Pass `enabled={false}` while the history UI is hidden (e.g. the Active
 * tab is showing) to skip both the mount fetch and focus refetches; the
 * query runs on the first flip to `true`. Defaults to `true` to preserve
 * the plain mount-load (e.g. Earnings, which always shows history).
 */
export function useMyDeliveryHistory(enabled = true): UseMyDeliveryHistoryResult {
  const [deliveries, setDeliveries] = useState<OrderWithDetails[]>([]);
  const [status, setStatus] = useState<DeliveryHistoryStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // True once any load succeeded: later focus/tab visits then refresh
  // silently instead of flashing the skeleton over visible history.
  const hasLoaded = useRef(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setStatus('loading');
    }
    setError(null);
    try {
      const next = await listMyDeliveryHistory();
      setDeliveries(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
      hasLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your delivery history.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Silent background refetch: preserves visible rows (no skeleton) and
  // keeps stale data on failure. Used for focus/tab revisits.
  const silentReload = useCallback(async () => {
    try {
      const next = await listMyDeliveryHistory();
      setDeliveries(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
      hasLoaded.current = true;
    } catch {
      // Keep stale data.
    }
  }, []);

  // Latest `enabled` for the focus callback (synced in an effect — refs
  // must not be written during render), plus the previous value so a
  // hidden→visible flip (tab switch, no focus event) triggers one load.
  // The list mirror serves the emitter subscription below.
  const enabledRef = useRef(enabled);
  const wasEnabled = useRef(enabled);
  const deliveriesRef = useRef<OrderWithDetails[]>([]);
  useEffect(() => {
    deliveriesRef.current = deliveries;
  }, [deliveries]);

  useFocusEffect(
    useCallback(() => {
      if (!enabledRef.current) return;
      if (hasLoaded.current) void silentReload();
      else void load(false);
    }, [load, silentReload]),
  );

  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled && !wasEnabled.current) {
      if (hasLoaded.current) void silentReload();
      else void load(false);
    }
    wasEnabled.current = enabled;
  }, [enabled, load, silentReload]);

  // A locally-closed job (terminal now) appears here without waiting for
  // a tab revisit — skipped while hidden (the flip-load above covers the
  // next visit).
  useEffect(() => {
    return subscribeOrderChanges((order) => {
      const { next, needsRefetch } = applyOrderChange(
        deliveriesRef.current,
        order,
        isTerminalOrderStatus(order.status),
      );
      if (needsRefetch) {
        if (enabledRef.current) void silentReload();
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
