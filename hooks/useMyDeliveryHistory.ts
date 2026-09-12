import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your delivery history.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Latest `enabled` for the focus callback (synced in an effect — refs
  // must not be written during render), plus the previous value so a
  // hidden→visible flip (tab switch, no focus event) triggers one load.
  const enabledRef = useRef(enabled);
  const wasEnabled = useRef(enabled);

  useFocusEffect(
    useCallback(() => {
      if (enabledRef.current) void load(false);
    }, [load]),
  );

  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled && !wasEnabled.current) void load(false);
    wasEnabled.current = enabled;
  }, [enabled, load]);

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { deliveries, status, error, refreshing, retry, refresh };
}
