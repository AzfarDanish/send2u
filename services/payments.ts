import { getSupabaseClient } from '@/lib/supabase';
import type { OrderStatus, Payment, PaymentStatus } from '@/types/domain';

/**
 * Payment service layer.
 *
 * State transitions go through `send2u_submit_payment` /
 * `send2u_review_payment` (client sends ids + Storage paths only; identity,
 * amounts, and states are derived server-side). `send2u_payment_context`
 * exposes exactly the QR reference + payment row the two parties may see.
 * Errors are thrown explicitly; nothing is swallowed.
 */

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface PaymentContext {
  orderId: string;
  orderStatus: OrderStatus;
  subtotalCents: number;
  deliveryFeeCents: number;
  /** Requester total: food subtotal + delivery fee. */
  totalCents: number;
  pickupCode: string | null;
  helperId: string | null;
  helperQrPath: string | null;
  payment: Payment | null;
}

function toPayment(orderId: string, value: Record<string, unknown>): Payment {
  const { amount_cents, evidence_path, status, submitted_at, verified_at } = value;
  if (
    typeof amount_cents !== 'number' ||
    typeof evidence_path !== 'string' ||
    typeof status !== 'string' ||
    typeof submitted_at !== 'string' ||
    (verified_at !== null && typeof verified_at !== 'string')
  ) {
    throw new Error('Payment data came back in an unexpected shape.');
  }
  return {
    orderId,
    amountCents: amount_cents,
    evidencePath: evidence_path,
    status: status as PaymentStatus,
    submittedAt: submitted_at,
    verifiedAt: verified_at,
    createdAt: submitted_at,
    updatedAt: verified_at ?? submitted_at,
  };
}

/** QR reference + payment row visible to this order's two parties. */
export async function getPaymentContext(orderId: string): Promise<PaymentContext> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_payment_context', { p_order_id: orderId });
  if (error) throw new Error(friendlyPaymentError(error.message));
  if (!isRecord(data)) throw new Error('Payment data came back in an unexpected shape.');
  const {
    order_status,
    subtotal_cents,
    delivery_fee_cents,
    pickup_code,
    helper_id,
    helper_qr_path,
    payment,
  } = data;
  if (
    typeof order_status !== 'string' ||
    typeof subtotal_cents !== 'number' ||
    typeof delivery_fee_cents !== 'number' ||
    (pickup_code !== null && typeof pickup_code !== 'string') ||
    (helper_id !== null && typeof helper_id !== 'string') ||
    (helper_qr_path !== null && typeof helper_qr_path !== 'string') ||
    (payment !== null && !isRecord(payment))
  ) {
    throw new Error('Payment data came back in an unexpected shape.');
  }
  return {
    orderId,
    orderStatus: order_status as OrderStatus,
    subtotalCents: subtotal_cents,
    deliveryFeeCents: delivery_fee_cents,
    totalCents: subtotal_cents + delivery_fee_cents,
    pickupCode: pickup_code,
    helperId: helper_id,
    helperQrPath: helper_qr_path,
    payment: payment ? toPayment(orderId, payment) : null,
  };
}

/** Submits (or resubmits after rejection) evidence for the caller's order. */
export async function submitPaymentEvidence(
  orderId: string,
  evidencePath: string,
): Promise<{ amountCents: number }> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_submit_payment', {
    p_order_id: orderId,
    p_evidence_path: evidencePath,
  });
  if (error) throw new Error(friendlyPaymentError(error.message));
  if (!isRecord(data) || typeof data.amount_cents !== 'number') {
    throw new Error('Payment submission came back in an unexpected shape.');
  }
  return { amountCents: data.amount_cents };
}

/** Assigned helper verifies or rejects submitted evidence. */
export async function reviewPayment(
  orderId: string,
  decision: 'verified' | 'rejected',
): Promise<{ status: PaymentStatus }> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_review_payment', {
    p_order_id: orderId,
    p_decision: decision,
  });
  if (error) throw new Error(friendlyPaymentError(error.message));
  if (!isRecord(data) || typeof data.status !== 'string') {
    throw new Error('Payment review came back in an unexpected shape.');
  }
  return { status: data.status as PaymentStatus };
}

function friendlyPaymentError(message: string): string {
  if (/not authenticated|session expired/i.test(message))
    return 'Your session expired. Sign in again and retry.';
  if (/order not found/i.test(message))
    return 'That order is not available to you.';
  if (/only.*assigned helper/i.test(message))
    return 'Only the helper assigned to this order can do that.';
  if (/only helpers/i.test(message)) return 'Only helpers can do that.';
  if (/opens after delivery/i.test(message))
    return 'Payment opens after the food is delivered.';
  if (/assigned orders/i.test(message))
    return 'Payment opens once a helper accepts this order.';
  if (/already submitted/i.test(message))
    return 'Evidence is already submitted and awaiting verification.';
  if (/already verified/i.test(message)) return 'This payment is already verified.';
  if (/no longer awaiting/i.test(message))
    return 'This payment was already reviewed. Refresh to see the latest state.';
  if (/invalid evidence|was not uploaded|receipt could not be attached/i.test(message))
    return 'That receipt could not be attached. Upload it again.';
  return message ? `Payment failed: ${message}` : 'Payment failed.';
}
