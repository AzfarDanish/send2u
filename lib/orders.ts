import type { OrderStatus, PaymentStatus } from '@/types/domain';

/** Short honest timestamp for order lists, e.g. "10 Sep, 3:45 PM". */
export function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Terminal states: the fulfilment/payment workflow is over. These orders
 * are historical records — never actionable. Everything else is active.
 * Kept as a single source of truth so list queries, badges, and detail
 * screens agree on what counts as "active work".
 */
export const TERMINAL_ORDER_STATUSES = ['completed', 'cancelled', 'disputed'] as const;

export type TerminalOrderStatus = (typeof TERMINAL_ORDER_STATUSES)[number];

const TERMINAL_SET: ReadonlySet<string> = new Set(TERMINAL_ORDER_STATUSES);

/** True for completed/cancelled/disputed — the history bucket. */
export function isTerminalOrderStatus(status: OrderStatus): status is TerminalOrderStatus {
  return TERMINAL_SET.has(status);
}

/** True for every non-terminal status (incl. legacy active values). */
export function isActiveOrderStatus(status: OrderStatus): boolean {
  return !TERMINAL_SET.has(status);
}

/** Badge tone per status across the fulfilment lifecycle. */
export function orderStatusTone(status: OrderStatus): 'info' | 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'pending':
    case 'assigned':
    case 'going_to_vendor':
    case 'at_vendor':
    case 'food_available':
    case 'food_purchased':
    case 'picked_up':
      return 'info';
    case 'out_for_delivery':
    case 'delivering':
      return 'warning';
    case 'delivered':
    case 'awaiting_requester_payment':
    case 'confirmed':
      return 'success';
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'disputed':
      return 'error';
    default:
      return 'neutral';
  }
}

/** Human label, e.g. "ready_for_pickup" → "Ready for pickup". */
export function orderStatusLabel(status: OrderStatus): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Payable total for one order: food subtotal + delivery fee. Both inputs
 * are database snapshots (the fee is fixed at RM2.00 server-side per
 * order) — the fee is never a client constant and is added exactly once,
 * here. Every surface showing a payable total must use this instead of
 * re-adding the two fields inline.
 */
export function orderTotalCents(subtotalCents: number, deliveryFeeCents: number): number {
  return subtotalCents + deliveryFeeCents;
}

/** Badge tone for the external-payment state (separate from order status). */
export function paymentStatusTone(status: PaymentStatus): 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'submitted':
      return 'info';
    case 'verified':
      return 'success';
    case 'rejected':
      return 'error';
  }
}

/** Human label for the payment state. */
export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'submitted':
      return 'Verification pending';
    case 'verified':
      return 'Payment verified';
    case 'rejected':
      return 'Payment rejected';
  }
}
