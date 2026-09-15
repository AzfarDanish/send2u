import { useSyncExternalStore } from 'react';

/**
 * Shared unread-notification count. One writer (`UnreadSync`, mounted once
 * per role layout with the existing `useUnreadCount` channel) feeds every
 * reader — header bells, badges — with zero queries or channels of their
 * own. Mutation hooks (`useNotifications`) push optimistic values here so
 * the global dot updates in the same frame as the list.
 */

let count = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Overwrite the shared count (writer only). No-op when unchanged. */
export function setUnreadCount(next: number): void {
  const normalized = Math.max(0, next);
  if (normalized === count) return;
  count = normalized;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return count;
}

/** Reader hook for bells and badges. Never fetches, never subscribes. */
export function useSharedUnreadCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
