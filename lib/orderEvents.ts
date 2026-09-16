import type { OrderWithDetails } from '@/types/domain';

export type OrderChangeHandler = (order: OrderWithDetails) => void;

const listeners = new Set<OrderChangeHandler>();

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
