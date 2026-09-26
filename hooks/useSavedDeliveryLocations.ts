import { useCallback, useEffect, useState } from 'react';

import { listSavedDeliveryLocations, setActiveSavedDeliveryLocation } from '@/services/savedLocations';
import type { SavedDeliveryLocation } from '@/types/domain';

export type SavedLocationsStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseSavedDeliveryLocationsResult {
  locations: SavedDeliveryLocation[];
  /** The single-select active location id, if any. */
  activeLocationId: string | null;
  status: SavedLocationsStatus;
  error: string | null;
  refreshing: boolean;
  /** Switches the active location and refreshes the list. */
  selectLocation: (id: string) => Promise<void>;
  selectingId: string | null;
  retry: () => void;
  refresh: () => Promise<void>;
}

/**
 * The requester's personal address book for the Deliver-to sheet. Loads once
 * on mount with state updates confined to the async continuation (below the
 * first await), so no synchronous set-state-in-effect is ever issued; retry
 * and refresh are event handlers. Selection goes through the atomic
 * server-side setter, then the list is re-read so the UI shows what was
 * really stored rather than what it hoped to store.
 */
export function useSavedDeliveryLocations(): UseSavedDeliveryLocationsResult {
  const [locations, setLocations] = useState<SavedDeliveryLocation[]>([]);
  const [status, setStatus] = useState<SavedLocationsStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setStatus('loading');
    setError(null);
    try {
      const next = await listSavedDeliveryLocations();
      setLocations(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load saved locations.');
      if (!isRefresh) setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Mount fetch only: state updates sit strictly after the await inside
    // the async continuation (with a cancelled guard), so this effect issues
    // no synchronous set-state of its own. Refresh/retry/select stay event
    // handlers on `load` above.
    let cancelled = false;
    (async () => {
      try {
        const next = await listSavedDeliveryLocations();
        if (cancelled) return;
        setLocations(next);
        setError(null);
        setStatus(next.length === 0 ? 'empty' : 'ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load saved locations.');
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const selectLocation = useCallback(
    async (id: string) => {
      setSelectingId(id);
      try {
        await setActiveSavedDeliveryLocation(id);
        await load(true);
      } finally {
        setSelectingId(null);
      }
    },
    [load],
  );

  const activeLocationId = locations.find((location) => location.isSelected)?.id ?? null;

  return { locations, activeLocationId, status, error, refreshing, selectLocation, selectingId, retry, refresh };
}
