import { useCallback, useEffect, useState } from 'react';

import { listDeliveryLocations } from '@/services/locations';
import type { DeliveryLocation } from '@/types/domain';

export type LocationsStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseDeliveryLocationsResult {
  locations: DeliveryLocation[];
  status: LocationsStatus;
  error: string | null;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
}

/**
 * Campus drop-off points. Loads once on mount; refresh is explicit
 * (pull-to-refresh / retry) so re-renders never refetch.
 */
export function useDeliveryLocations(): UseDeliveryLocationsResult {
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [status, setStatus] = useState<LocationsStatus>('loading');
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
      const next = await listDeliveryLocations();
      setLocations(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load delivery locations.');
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

  return { locations, status, error, refreshing, retry, refresh };
}
