import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeLocationsChanged, emitLocationsChanged } from '@/lib/locationEvents';
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
 * The requester's personal address book for the Deliver-to sheet.
 *
 * Freshness has three legs, because a save on one screen must show on
 * every other without a manual reload: (1) silent reload on screen focus
 * (returning from set-location never remounts the tab, so mount-fetch
 * alone goes stale); (2) the local locations emitter (set-location and
 * selection switches notify mounted consumers at the mutation site);
 * (3) explicit retry/refresh event handlers. State updates stay confined
 * to async continuations, so no synchronous set-state-in-effect is ever
 * issued. Selection goes through the atomic server-side setter, then the
 * list is re-read so the UI shows what was really stored rather than what
 * it hoped to store.
 */
export function useSavedDeliveryLocations(): UseSavedDeliveryLocationsResult {
  const [locations, setLocations] = useState<SavedDeliveryLocation[]>([]);
  const [status, setStatus] = useState<SavedLocationsStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  // True once any load succeeded: focus returns then refresh silently
  // instead of flashing the skeleton over visible rows.
  const hasLoaded = useRef(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setStatus('loading');
    setError(null);
    try {
      const next = await listSavedDeliveryLocations();
      setLocations(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
      hasLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load saved locations.');
      if (!isRefresh) setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Preserving background refetch for focus returns and local mutation
  // events. Never blanks; failures keep stale rows.
  const silentReload = useCallback(async () => {
    try {
      const next = await listSavedDeliveryLocations();
      setLocations(next);
      setError(null);
      setStatus(next.length === 0 ? 'empty' : 'ready');
      hasLoaded.current = true;
    } catch {
      // Keep stale data.
    }
  }, []);

  // Returning from set-location (or any other screen) never remounts, so
  // the mount fetch alone would serve the pre-save list forever. Preserve
  // visible rows on return; skeleton only when nothing ever loaded.
  useFocusEffect(
    useCallback(() => {
      if (hasLoaded.current) void silentReload();
      else void load(false);
    }, [load, silentReload]),
  );

  // A save on set-location (or a selection switch anywhere) notifies every
  // mounted consumer at the mutation site — no waiting for the next focus.
  useEffect(() => {
    return subscribeLocationsChanged(() => {
      void silentReload();
    });
  }, [silentReload]);

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
        // Other mounted consumers (the checkout card behind the open sheet,
        // the home header) hold their own copy — notify them too. The extra
        // reload on this instance is one tiny query on a user-initiated tap.
        emitLocationsChanged();
      } finally {
        setSelectingId(null);
      }
    },
    [load],
  );

  const activeLocationId = locations.find((location) => location.isSelected)?.id ?? null;

  return { locations, activeLocationId, status, error, refreshing, selectLocation, selectingId, retry, refresh };
}
