import { useCallback, useEffect, useState } from 'react';

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
 */
export function useMyOrderHistory(): UseMyOrderHistoryResult {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [status, setStatus] = useState<MyOrderHistoryStatus>('loading');
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
      const next = await listMyOrderHistory();
      setOrders(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your order history.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { orders, status, error, refreshing, retry, refresh };
}
