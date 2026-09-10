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
