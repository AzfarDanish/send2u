import { dedupeRequest } from '@/lib/dedupe';
import { orderTotalCents } from '@/lib/orders';
import { getSupabaseClient } from '@/lib/supabase';
import type {
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Settlement,
  SettlementStatus,
} from '@/types/domain';
import { toSettlement } from '@/services/orders';

/**
 * Platform transaction service layer.
 *
 * Send2U records and manages every transaction: online payments are
 * simulated in-app (competition prototype — no real money moves) and COD
 * cash collection is recorded by the helper. Clients send ids only;
 * amounts, splits, and states are derived server-side through
 * SECURITY DEFINER RPCs. Errors are thrown explicitly; nothing is swallowed.
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

export interface TransactionContext {
  orderId: string;
  orderStatus: OrderStatus;
  subtotalCents: number;
  deliveryFeeCents: number;
  /** Requester total: food subtotal + delivery fee. */
  totalCents: number;
  helperId: string | null;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  settlementStatus: SettlementStatus;
  paidAt: string | null;
  codExpectedCents: number | null;
  codCollectedCents: number | null;
  codCollectedAt: string | null;
  settledAt: string | null;
  refundedAt: string | null;
  payment: Payment | null;
  settlement: Settlement | null;
}

/** Backwards-compatible alias: payment context is the transaction context. */
export type PaymentContext = TransactionContext;

function toPayment(orderId: string, value: Record<string, unknown>): Payment {
  const {
    amount_cents,
    status,
    method,
    provider_ref,
    attempt_count,
    last_error,
    submitted_at,
    paid_at,
  } = value;
  if (
    typeof amount_cents !== 'number' ||
    typeof status !== 'string' ||
    (method !== null && typeof method !== 'string') ||
    (provider_ref !== null && typeof provider_ref !== 'string') ||
    typeof submitted_at !== 'string'
  ) {
    throw new Error('Payment data came back in an unexpected shape.');
  }
  return {
    orderId,
    amountCents: amount_cents,
    evidencePath: null,
    status: status as PaymentStatus,
    method: (method as PaymentMethod | null) ?? null,
    providerRef: (provider_ref as string | null) ?? null,
    attemptCount: typeof attempt_count === 'number' ? attempt_count : 0,
    lastError: (last_error as string | null) ?? null,
    submittedAt: submitted_at,
    paidAt: (paid_at as string | null) ?? null,
    verifiedAt: null,
    createdAt: submitted_at,
    updatedAt: ((paid_at as string | null) ?? submitted_at) as string,
  };
}

/**
 * Full transaction view visible to this order's parties (requester, assigned
 * helper, owning vendor). In-flight deduped per order.
 */
export async function getPaymentContext(orderId: string): Promise<TransactionContext> {
  return dedupeRequest(`send2u:payment-context:${orderId}`, async () => {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('send2u_payment_context', { p_order_id: orderId });
    if (error) throw new Error(friendlyPaymentError(error.message));
    if (!isRecord(data)) throw new Error('Payment data came back in an unexpected shape.');
    const {
      order_status,
      subtotal_cents,
      delivery_fee_cents,
      helper_id,
      payment_method,
      payment_status,
      settlement_status,
      paid_at,
      cod_expected_cents,
      cod_collected_cents,
      cod_collected_at,
      settled_at,
      refunded_at,
      payment,
      settlement,
    } = data;
    if (
      typeof order_status !== 'string' ||
      typeof subtotal_cents !== 'number' ||
      typeof delivery_fee_cents !== 'number' ||
      (helper_id !== null && typeof helper_id !== 'string') ||
      (payment_method !== null && typeof payment_method !== 'string') ||
      typeof payment_status !== 'string' ||
      typeof settlement_status !== 'string' ||
      (payment !== null && !isRecord(payment)) ||
      (settlement !== null && !isRecord(settlement))
    ) {
      throw new Error('Payment data came back in an unexpected shape.');
    }
    return {
      orderId,
      orderStatus: order_status as OrderStatus,
      subtotalCents: subtotal_cents,
      deliveryFeeCents: delivery_fee_cents,
      totalCents: orderTotalCents(subtotal_cents, delivery_fee_cents),
      helperId: helper_id,
      paymentMethod: (payment_method as PaymentMethod | null) ?? null,
      paymentStatus: payment_status as PaymentStatus,
      settlementStatus: settlement_status as SettlementStatus,
      paidAt: (paid_at as string | null) ?? null,
      codExpectedCents: (cod_expected_cents as number | null) ?? null,
      codCollectedCents: (cod_collected_cents as number | null) ?? null,
      codCollectedAt: (cod_collected_at as string | null) ?? null,
      settledAt: (settled_at as string | null) ?? null,
      refundedAt: (refunded_at as string | null) ?? null,
      payment: payment ? toPayment(orderId, payment) : null,
      settlement: settlement
        ? toSettlement(orderId, {
            order_id: orderId,
            vendor_amount_cents: (settlement as Record<string, unknown>).vendor_amount_cents as number,
            helper_amount_cents: (settlement as Record<string, unknown>).helper_amount_cents as number,
            platform_amount_cents: (settlement as Record<string, unknown>).platform_amount_cents as number,
            commission_bps: (settlement as Record<string, unknown>).commission_bps as number,
            status: (settlement as Record<string, unknown>).status as string,
          })
        : null,
    };
  });
}

export interface OnlinePaymentIntent {
  orderId: string;
  status: PaymentStatus;
  amountCents: number;
  providerRef: string | null;
}

/** Starts (or resumes) the simulated online payment. Idempotent while pending. */
export async function initiateOnlinePayment(orderId: string): Promise<OnlinePaymentIntent> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_initiate_payment', { p_order_id: orderId });
  if (error) throw new Error(friendlyPaymentError(error.message));
  if (!isRecord(data) || typeof data.status !== 'string' || typeof data.amount_cents !== 'number') {
    throw new Error('Payment initiation came back in an unexpected shape.');
  }
  return {
    orderId,
    status: data.status as PaymentStatus,
    amountCents: data.amount_cents,
    providerRef: (data.provider_ref as string | null) ?? null,
  };
}

/**
 * Completes the simulated online payment (success or test failure).
 * Duplicate completions with the same reference are safe no-ops.
 */
export async function completeOnlinePayment(
  orderId: string,
  providerRef: string,
  success: boolean,
): Promise<OnlinePaymentIntent> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_complete_payment', {
    p_order_id: orderId,
    p_provider_ref: providerRef,
    p_success: success,
  });
  if (error) throw new Error(friendlyPaymentError(error.message));
  if (!isRecord(data) || typeof data.status !== 'string' || typeof data.amount_cents !== 'number') {
    throw new Error('Payment completion came back in an unexpected shape.');
  }
  return {
    orderId,
    status: data.status as PaymentStatus,
    amountCents: data.amount_cents,
    providerRef,
  };
}

/** Helper records COD cash collected. Safe against double submission. */
export async function confirmCodCollection(
  orderId: string,
): Promise<{ status: PaymentStatus; amountCents: number }> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_confirm_cod_collection', {
    p_order_id: orderId,
  });
  if (error) throw new Error(friendlyPaymentError(error.message));
  if (!isRecord(data) || typeof data.status !== 'string' || typeof data.amount_cents !== 'number') {
    throw new Error('Cash collection came back in an unexpected shape.');
  }
  return { status: data.status as PaymentStatus, amountCents: data.amount_cents };
}

export function friendlyPaymentError(message: string): string {
  if (/not authenticated|session expired/i.test(message))
    return 'Your session expired. Sign in again and retry.';
  if (/order not found/i.test(message)) return 'That order is not available to you.';
  if (/cash on delivery/i.test(message))
    return 'This order is cash on delivery — pay the helper in cash when your food arrives.';
  if (/already closed/i.test(message))
    return 'This order is already closed. Refresh to see the latest state.';
  if (/unknown payment reference/i.test(message))
    return 'That payment session expired. Start the payment again.';
  if (/cannot be started/i.test(message))
    return 'Payment cannot be started for this order right now. Refresh and try again.';
  if (/deliver the food/i.test(message))
    return 'Deliver the food before collecting cash.';
  if (/not cash on delivery/i.test(message)) return 'Only COD orders collect cash.';
  if (/cash cannot be collected/i.test(message))
    return 'Cash has already been recorded for this order. Refresh to see the latest state.';
  return message ? `Payment failed: ${message}` : 'Payment failed.';
}
