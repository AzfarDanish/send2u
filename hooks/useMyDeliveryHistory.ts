import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

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
 * accepted first. Read-only records — refetches on focus like the active
 * list so a just-closed job appears without manual refresh.
 */
export function useMyDeliveryHistory(): UseMyDeliveryHistoryResult {
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

  return { deliveries, status, error, refreshing, retry, refresh };
}
