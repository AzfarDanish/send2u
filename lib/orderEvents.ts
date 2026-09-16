import type { OrderWithDetails } from '@/types/domain';

export type OrderChangeHandler = (order: OrderWithDetails) => void;

const listeners = new Set<OrderChangeHandler>();
const deleteListeners = new Set<(orderId: string) => void>();

/**
 * Subscribe to local order mutations (accept, advance, cancel, confirm,
 * dispute, payment…). Returns an unsubscribe function for `useEffect`
 * cleanup. A throwing listener must never break the others.
 */
export function subscribeOrderChanges(handler: OrderChangeHandler): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

/**
 * Subscribe to local order deletions (clean cancel before purchase, food
 * unavailable, dispute resolved-as-cancelled). Deleted orders are permanently
 * gone server-side, so mounted lists must drop the row rather than patch it.
 */
export function subscribeOrderDeletes(handler: (orderId: string) => void): () => void {
  deleteListeners.add(handler);
  return () => {
    deleteListeners.delete(handler);
  };
}

/**
 * Notify mounted lists/cards that one order changed. Fire-and-forget:
 * subscribers patch their own state synchronously; network reconciliation
 * (realtime echo, silent refetch) converges afterwards. Never emits stale
 * data — callers pass the mutation's authoritative result.
 */
export function emitOrderChanged(order: OrderWithDetails): void {
  listeners.forEach((handler) => {
    try {
      handler(order);
    } catch {
      // One bad listener must not break the others.
    }
  });
}

/**
 * Notify mounted lists/cards that one order was permanently deleted. The
 * order no longer exists server-side, so consumers drop the row. Unknown
 * ids are a no-op for everyone.
 */
export function emitOrderDeleted(orderId: string): void {
  deleteListeners.forEach((handler) => {
    try {
      handler(orderId);
    } catch {
      // One bad listener must not break the others.
    }
  });
}

export interface OrderListPatch {
  /** Next list contents (same reference when nothing changed). */
  next: OrderWithDetails[];
  /**
   * True when the order newly belongs here but isn't present — the caller
   * should run its preserving silent refetch (membership/ordering can't be
   * derived from one record alone).
   */
  needsRefetch: boolean;
}

/**
 * Pure list op for an order-change event. Patches the row in place when
 * present, drops it when it left this bucket (`belongs === false`), and
 * asks for a silent refetch when it newly belongs here. Never blanks,
 * never reorders, never touches other rows — keys stay stable so only the
 * affected card re-renders.
 */
export function applyOrderChange(
  prev: OrderWithDetails[],
  order: OrderWithDetails,
  belongs: boolean,
): OrderListPatch {
  const index = prev.findIndex((item) => item.id === order.id);
  if (index === -1) {
    return { next: prev, needsRefetch: belongs };
  }
  if (!belongs) {
    return { next: prev.filter((item) => item.id !== order.id), needsRefetch: false };
  }
  if (prev[index] === order) return { next: prev, needsRefetch: false };
  const next = prev.slice();
  next[index] = order;
  return { next, needsRefetch: false };
}

/**
 * Pure list op for an order-deletion event. Drops the deleted row when
 * present; otherwise leaves the list untouched. Deleting from a bucket is
 * deterministic, so no refetch is ever requested.
 */
export function applyOrderDeleted(prev: OrderWithDetails[], orderId: string): OrderListPatch {
  const index = prev.findIndex((item) => item.id === orderId);
  if (index === -1) return { next: prev, needsRefetch: false };
  const next = prev.slice();
  next.splice(index, 1);
  return { next, needsRefetch: false };
}
