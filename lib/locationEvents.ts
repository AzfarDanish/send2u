export type LocationsChangedHandler = () => void;

const listeners = new Set<LocationsChangedHandler>();

/**
 * Subscribe to local saved-location mutations (create, update, active
 * switch). Returns an unsubscribe function for `useEffect` cleanup.
 * A throwing listener must never break the others.
 *
 * Mirrors `lib/orderEvents.ts`: the address book is single-user data, so
 * cross-screen staleness is fixed deterministically at the mutation site
 * rather than by polling or realtime. Payload-free on purpose — every
 * subscriber re-reads its own query (list shape, selection, and ordering
 * can't be derived from one write).
 */
export function subscribeLocationsChanged(handler: LocationsChangedHandler): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

/**
 * Notify mounted address-book consumers that the set changed. Fire-and-
 * forget: subscribers run their preserving silent reload; failures keep
 * stale rows and the next focus/pull-to-refresh converges.
 */
export function emitLocationsChanged(): void {
  listeners.forEach((handler) => {
    try {
      handler();
    } catch {
      // One bad listener must not break the others.
    }
  });
}
