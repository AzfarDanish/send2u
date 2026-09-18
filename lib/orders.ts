import type { OrderStatus, PaymentMethod, PaymentStatus, SettlementStatus } from '@/types/domain';

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
 * Relative age for inbox-style surfaces (notifications), e.g. "5 min ago".
 * Falls back to `formatOrderDate` beyond 7 days or for invalid input.
 * Presentation-only: same timestamp, friendlier triage.
 */
export function formatRelativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatOrderDate(iso);
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

/**
 * Maximum concurrent active deliveries per helper, enforced server-side
 * in `send2u_accept_order` (race-safe) and mirrored in UI gating. Keep
 * the two in agreement if this ever changes.
 */
export const MAX_ACTIVE_JOBS_PER_HELPER = 3;

/**
 * Short human status for a helper's own active job rows. Plain words,
 * never raw state keys — e.g. "At vendor", "Picked up".
 */
export function helperStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'assigned':
      return 'Assigned';
    case 'preparing':
      return 'Being prepared';
    case 'ready_for_pickup':
      return 'Ready for pickup';
    case 'going_to_vendor':
      return 'Going to vendor';
    case 'at_vendor':
      return 'At vendor';
    case 'food_available':
      return 'Food available';
    case 'food_purchased':
      return 'Purchased';
    case 'picked_up':
      return 'Picked up';
    case 'out_for_delivery':
    case 'delivering':
      return 'On the way';
    case 'delivered':
      return 'Delivered';
    case 'confirmed':
    case 'awaiting_requester_payment':
      return 'Confirmed';
    default:
      return orderStatusLabel(status);
  }
}

/** Badge tone per status across the fulfilment lifecycle. */
export function orderStatusTone(status: OrderStatus): 'info' | 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'pending':
    case 'assigned':
    case 'preparing':
    case 'ready_for_pickup':
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

/**
 * Human label for a raw status key, e.g. "ready_for_pickup" → "Ready for
 * pickup". Sentence case, not title case: only the first word is
 * capitalised, so multi-word keys read as English ("Out for delivery",
 * not "Out For Delivery"). Hand-written labels elsewhere follow the same
 * convention — this generic fallback must match them.
 */
export function orderStatusLabel(status: OrderStatus): string {
  const [first, ...rest] = status.split('_');
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

/**
 * Display-only estimate of the per-order delivery fee in MYR cents,
 * used for pre-submit totals on the Review Request screen.
 * The authoritative fee is recorded server-side per order
 * (`delivery_fee_cents`); this constant must never be treated as the
 * charged amount — estimates are always labeled as such.
 */
export const ESTIMATED_DELIVERY_FEE_CENTS = 200;

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

/** Badge tone for the platform payment state (separate from order status). */
export function paymentStatusTone(status: PaymentStatus): 'info' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'submitted':
    case 'pending':
    case 'refund_pending':
      return 'info';
    case 'verified':
    case 'paid':
    case 'collected':
      return 'success';
    case 'unpaid':
    case 'failed':
    case 'not_collected':
      return 'warning';
    case 'rejected':
    case 'refunded':
    case 'cancelled':
      return 'error';
  }
}

/**
 * Human label for the payment state. `method` disambiguates states that
 * mean different things per rail: `unpaid` is a cash-due state on COD but
 * a plain outstanding payment on an online order — labelling an online
 * order "Cash due on delivery" is wrong copy. Pass the order's method
 * wherever it is known; omit it only when the rail genuinely is not.
 */
export function paymentStatusLabel(status: PaymentStatus, method?: PaymentMethod | null): string {
  switch (status) {
    case 'submitted':
      return 'Verification pending';
    case 'verified':
      return 'Payment verified';
    case 'rejected':
      return 'Payment rejected';
    case 'unpaid':
      return method === 'cod' ? 'Cash due on delivery' : 'Payment due';
    case 'pending':
      return 'Payment processing';
    case 'paid':
      return 'Paid';
    case 'failed':
      return 'Payment failed';
    case 'collected':
      return 'Cash collected';
    case 'not_collected':
      return 'Cash not collected';
    case 'refunded':
      return 'Refunded';
    case 'refund_pending':
      return 'Refund pending';
    case 'cancelled':
      return 'Payment cancelled';
  }
}

/** Human label for the payment method. */
export function paymentMethodLabel(method: PaymentMethod | null): string {
  switch (method) {
    case 'online':
      return 'Online Payment';
    case 'cod':
      return 'Cash on Delivery';
    default:
      return 'Payment';
  }
}

/** Human label for the settlement state. */
export function settlementStatusLabel(status: SettlementStatus): string {
  switch (status) {
    case 'pending':
      return 'Settlement pending';
    case 'settled':
      return 'Settled';
    case 'failed':
      return 'Settlement failed';
    case 'reversed':
      return 'Settlement reversed';
  }
}

/**
 * Accurate user-facing status wording for requesters. Describes only the
 * actual backend state — never claims arrival times. Legacy display values
 * map to their closest honest equivalent.
 */
export function requesterStatusMessage(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'Waiting for a helper';
    case 'assigned':
    case 'accepted':
      return 'Helper assigned';
    case 'preparing':
      return 'Vendor is preparing your food';
    case 'ready_for_pickup':
      return 'Food is ready for pickup';
    case 'going_to_vendor':
      return 'Helper is going to the vendor';
    case 'at_vendor':
      return 'Helper is at the vendor';
    case 'food_available':
      return 'Food is available';
    case 'food_purchased':
      return 'Food secured';
    case 'picked_up':
      return 'Request picked up';
    case 'out_for_delivery':
    case 'delivering':
      return 'On the way';
    case 'delivered':
      return 'Delivered';
    case 'confirmed':
    case 'awaiting_requester_payment':
      return 'Confirmed — finishing up';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'disputed':
      return 'Under review';
    default:
      return orderStatusLabel(status);
  }
}

/**
 * Concise request title from item snapshots, e.g. "Nasi Ayam + Teh Ais"
 * or "Nasi Ayam + 2 more". Pure display helper — no backend meaning.
 */
export function orderItemsTitle(items: { itemName: string; quantity: number }[]): string {
  if (items.length === 0) return 'Your request';
  if (items.length === 1) {
    const only = items[0];
    return only.quantity > 1 ? `${only.quantity} × ${only.itemName}` : only.itemName;
  }
  if (items.length === 2) return `${items[0].itemName} + ${items[1].itemName}`;
  return `${items[0].itemName} + ${items.length - 1} more`;
}
