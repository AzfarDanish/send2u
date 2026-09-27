import { dedupeRequest } from '@/lib/dedupe';
import { getSupabaseClient } from '@/lib/supabase';
import type {
  AcceptedOrderSummary,
  OrderItem,
  OrderStatus,
  OrderWithDetails,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PlaceOrderLine,
  PlacedOrderSummary,
  Settlement,
  SettlementStatus,
} from '@/types/domain';

/**
 * Order service layer.
 *
 * Writes go exclusively through database functions: `send2u_place_orders`
 * for requester creation and `send2u_accept_order` for helper acceptance.
 * The client sends only ids (+ quantities); the database derives prices,
 * snapshots, ownership, roles, and statuses server-side. There are
 * deliberately no direct table-write functions here — clients hold
 * SELECT-only grants. Errors are thrown explicitly; nothing is swallowed.
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

interface OrderItemRow {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  created_at: string;
}

interface PaymentRow {
  order_id: string;
  amount_cents: number;
  evidence_path: string | null;
  status: string;
  method: string | null;
  provider_ref: string | null;
  attempt_count: number | null;
  last_error: string | null;
  submitted_at: string;
  paid_at: string | null;
}

interface SettlementRow {
  order_id: string;
  vendor_amount_cents: number;
  helper_amount_cents: number;
  platform_amount_cents: number;
  commission_bps: number;
  status: string;
}

interface OrderRow {
  id: string;
  requester_id: string;
  vendor_id: string;
  delivery_location_id: string | null;
  saved_location_id: string | null;
  delivery_instruction: string | null;
  leave_at_door: boolean | null;
  status: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  pickup_code: string;
  payment_method: string | null;
  payment_status: string;
  settlement_status: string;
  paid_at: string | null;
  cod_expected_cents: number | null;
  cod_collected_cents: number | null;
  cod_collected_at: string | null;
  settled_at: string | null;
  refunded_at: string | null;
  refund_reason: string | null;
  helper_id: string | null;
  accepted_at: string | null;
  going_to_vendor_at: string | null;
  arrived_at: string | null;
  food_available_at: string | null;
  purchased_at: string | null;
  food_cost_cents: number | null;
  picked_up_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  dispute_reason: string | null;
  dispute_details: string | null;
  dispute_note: string | null;
  disputed_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  vendor: { id: string; name: string; location_hint: string | null; pickup_lat: number | null; pickup_lng: number | null } | null;
  saved_location: { id: string; label: string; sub_details: string | null; location_type: string; lat: number | null; lng: number | null } | null;
  send2u_order_items: OrderItemRow[] | null;
  // To-one (UNIQUE order_id) embeds decode as a single object, not an array.
  send2u_payments: PaymentRow | PaymentRow[] | null;
}

function toPayment(orderId: string, row: PaymentRow): Payment {
  return {
    orderId,
    amountCents: row.amount_cents,
    evidencePath: row.evidence_path,
    status: row.status as PaymentStatus,
    method: (row.method as PaymentMethod | null) ?? null,
    providerRef: row.provider_ref,
    attemptCount: row.attempt_count ?? 0,
    lastError: row.last_error,
    submittedAt: row.submitted_at,
    paidAt: row.paid_at,
    verifiedAt: null,
    createdAt: row.submitted_at,
    updatedAt: row.paid_at ?? row.submitted_at,
  };
}

export function toSettlement(orderId: string, row: SettlementRow): Settlement {
  return {
    orderId,
    vendorAmountCents: row.vendor_amount_cents,
    helperAmountCents: row.helper_amount_cents,
    platformAmountCents: row.platform_amount_cents,
    commissionBps: row.commission_bps,
    status: row.status as SettlementStatus,
  };
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    menuItemId: row.menu_item_id,
    itemName: row.item_name,
    unitPriceCents: row.unit_price_cents,
    quantity: row.quantity,
    lineTotalCents: row.line_total_cents,
    createdAt: row.created_at,
  };
}

function toOrderWithDetails(row: OrderRow): OrderWithDetails {
  // New orders carry a saved address-book location. The shared delivery-points
  // table that used to cover older rows is gone from the schema, so an order
  // without a saved location has no fetchable place name: the requester's own
  // instruction is the only surviving description of the drop-off, and the pin
  // stays null rather than becoming a stand-in coordinate.
  const instruction = row.delivery_instruction?.trim() || null;
  const location = row.saved_location
    ? {
        id: row.saved_location.id,
        name: row.saved_location.label,
        description: row.saved_location.sub_details,
        lat: row.saved_location.lat,
        lng: row.saved_location.lng,
      }
    : {
        id: row.saved_location_id ?? row.id,
        name: instruction ?? 'Delivery point removed',
        description: instruction ? 'Saved location removed' : null,
        lat: null,
        lng: null,
      };
  if (!row.vendor) {
    throw new Error('Order references data that is no longer visible.');
  }
  return {
    id: row.id,
    requesterId: row.requester_id,
    vendorId: row.vendor_id,
    deliveryLocationId: row.delivery_location_id,
    savedLocationId: row.saved_location_id,
    deliveryInstruction: row.delivery_instruction,
    leaveAtDoor: row.leave_at_door ?? false,
    status: row.status as OrderStatus,
    subtotalCents: row.subtotal_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    pickupCode: row.pickup_code,
    paymentMethod: (row.payment_method as PaymentMethod | null) ?? null,
    paymentStatus: (row.payment_status as PaymentStatus) ?? 'unpaid',
    settlementStatus: (row.settlement_status as SettlementStatus) ?? 'pending',
    paidAt: row.paid_at,
    codExpectedCents: row.cod_expected_cents,
    codCollectedCents: row.cod_collected_cents,
    codCollectedAt: row.cod_collected_at,
    settledAt: row.settled_at,
    refundedAt: row.refunded_at,
    refundReason: row.refund_reason,
    helperId: row.helper_id,
    acceptedAt: row.accepted_at,
    goingToVendorAt: row.going_to_vendor_at,
    arrivedAt: row.arrived_at,
    foodAvailableAt: row.food_available_at,
    purchasedAt: row.purchased_at,
    foodCostCents: row.food_cost_cents,
    pickedUpAt: row.picked_up_at,
    outForDeliveryAt: row.out_for_delivery_at,
    deliveredAt: row.delivered_at,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    cancelReason: row.cancel_reason,
    disputeReason: row.dispute_reason,
    disputeDetails: row.dispute_details,
    disputeNote: row.dispute_note,
    disputedAt: row.disputed_at,
    resolvedAt: row.resolved_at,
    resolution: row.resolution,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vendor: {
      id: row.vendor.id,
      name: row.vendor.name,
      locationHint: row.vendor.location_hint,
      // Both pins ride along on every order read: without them a tracking map
      // has nothing real to draw, and a missing pin stays null rather than
      // becoming a stand-in coordinate.
      pickupLat: row.vendor.pickup_lat,
      pickupLng: row.vendor.pickup_lng,
    },
    location: {
      id: location.id,
      name: location.name,
      description: location.description,
      lat: location.lat,
      lng: location.lng,
    },
    items: (row.send2u_order_items ?? []).map(toOrderItem),
    payment: normalizePayments(row.send2u_payments).slice(0, 1).map((p) => toPayment(row.id, p))[0] ?? null,
  };
}

function normalizePayments(value: PaymentRow | PaymentRow[] | null): PaymentRow[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toPlacedSummary(value: unknown): PlacedOrderSummary {
  if (!isRecord(value)) throw new Error('Order creation returned an unexpected result.');
  const { order_id, vendor_id, vendor_name, subtotal_cents, delivery_fee_cents, item_count, status, payment_method, created_at } = value;
  if (
    typeof order_id !== 'string' ||
    typeof vendor_id !== 'string' ||
    typeof vendor_name !== 'string' ||
    typeof subtotal_cents !== 'number' ||
    typeof delivery_fee_cents !== 'number' ||
    typeof item_count !== 'number' ||
    typeof status !== 'string' ||
    typeof created_at !== 'string'
  ) {
    throw new Error('Order creation returned an unexpected result.');
  }
  return {
    orderId: order_id,
    vendorId: vendor_id,
    vendorName: vendor_name,
    subtotalCents: subtotal_cents,
    deliveryFeeCents: delivery_fee_cents,
    itemCount: item_count,
    status: status as OrderStatus,
    paymentMethod: (payment_method as PaymentMethod | undefined) ?? null,
    createdAt: created_at,
  };
}

const ORDER_SELECT =
  'id, requester_id, vendor_id, delivery_location_id, saved_location_id, delivery_instruction, leave_at_door, status, subtotal_cents, delivery_fee_cents, pickup_code,' +
  ' payment_method, payment_status, settlement_status, paid_at, cod_expected_cents, cod_collected_cents, cod_collected_at, settled_at, refunded_at, refund_reason,' +
  ' helper_id, accepted_at, going_to_vendor_at, arrived_at, food_available_at, purchased_at, food_cost_cents, picked_up_at, out_for_delivery_at, delivered_at, confirmed_at,' +
  ' cancelled_at, cancelled_by, cancel_reason, dispute_reason, dispute_details, dispute_note, disputed_at, resolved_at, resolution,' +
  ' created_at, updated_at,' +
  ' vendor:send2u_vendors!inner(id, name, location_hint, pickup_lat, pickup_lng),' +
  ' saved_location:send2u_saved_delivery_locations!left(id, label, sub_details, location_type, lat, lng),' +
  ' send2u_order_items(id, order_id, menu_item_id, item_name, unit_price_cents, quantity, line_total_cents, created_at),' +
  ' send2u_payments(order_id, amount_cents, evidence_path, status, method, provider_ref, attempt_count, last_error, submitted_at, paid_at)';

/** Current user id for owner-scoped reads. Throws when signed out. */
async function requireUserId(): Promise<string> {
  const supabase = requireClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Could not load your orders: ${error.message}`);
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Your session expired. Sign in again and retry.');
  return userId;
}

/**
 * Places the cart: one order per vendor sharing the delivery location and
 * payment method. Prices and snapshots come from the database — the `lines`
 * carry ids and quantities only, so requester-supplied totals are never
 * trusted. Send2U records the transaction from birth (online=pending,
 * COD=unpaid); no helper financing is involved.
 *
 * New checkouts point at a saved address-book location; `deliveryLocationId`
 * stays only for legacy callers (none left in the app) and old shared-point
 * orders keep reading through the mapper fallback.
 */
export interface PlaceOrdersInput {
  savedLocationId?: string | null;
  deliveryLocationId?: string | null;
  lines: PlaceOrderLine[];
  paymentMethod: PaymentMethod;
  instruction?: string | null;
  leaveAtDoor?: boolean;
}

export async function placeOrders(input: PlaceOrdersInput): Promise<PlacedOrderSummary[]> {
  const {
    savedLocationId = null,
    deliveryLocationId = null,
    lines,
    paymentMethod,
    instruction = null,
    leaveAtDoor = false,
  } = input;
  const supabase = requireClient();
  if (lines.length === 0) throw new Error('Your cart is empty.');
  if (!savedLocationId && !deliveryLocationId) {
    throw new Error('Choose where to deliver.');
  }
  if (paymentMethod !== 'online' && paymentMethod !== 'cod') {
    throw new Error('Choose how you want to pay.');
  }
  const { data, error } = await supabase.rpc('send2u_place_orders', {
    p_delivery_location_id: deliveryLocationId,
    p_items: lines.map((line) => ({ menu_item_id: line.menuItemId, quantity: line.quantity })),
    p_payment_method: paymentMethod,
    p_saved_location_id: savedLocationId,
    p_delivery_instruction: instruction,
    p_leave_at_door: leaveAtDoor,
  });
  if (error) throw new Error(friendlyOrderError(error.message));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Order creation returned an unexpected result.');
  }
  return (data as unknown[]).map(toPlacedSummary);
}

/**
 * Requester's ACTIVE orders only (as requester), newest first.
 * Terminal states (completed/cancelled/disputed) are excluded here by the
 * query itself — they live in `listMyOrderHistory`. RLS still enforces
 * ownership; this filter enforces the active/history separation.
 */
export async function listMyOrders(): Promise<OrderWithDetails[]> {
  const supabase = requireClient();
  const userId = await requireUserId();
  // In-flight deduped (keyed by user: dev-profile switches share the
  // runtime): mounted lists + realtime echoes ask together, one request.
  return dedupeRequest(`send2u:my-orders:${userId}`, async () => {
    const { data, error } = await supabase
      .from('send2u_orders')
      .select(ORDER_SELECT)
      .eq('requester_id', userId)
      .not('status', 'in', '(completed,cancelled,disputed)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Could not load your orders: ${error.message}`);
    return (data as unknown as OrderRow[]).map(toOrderWithDetails);
  });
}

/**
 * HISTORICAL orders only (completed/cancelled/disputed),
 * newest first. Read-only records — no actions are valid on these.
 * Nothing is deleted or archived elsewhere; same table, status-filtered.
 */
export async function listMyOrderHistory(): Promise<OrderWithDetails[]> {
  const supabase = requireClient();
  const userId = await requireUserId();
  return dedupeRequest(`send2u:my-order-history:${userId}`, async () => {
    const { data, error } = await supabase
      .from('send2u_orders')
      .select(ORDER_SELECT)
      .eq('requester_id', userId)
      .in('status', ['completed', 'cancelled', 'disputed'])
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Could not load your order history: ${error.message}`);
    return (data as unknown as OrderRow[]).map(toOrderWithDetails);
  });
}

/** Single own order with snapshots. Null when not visible to the caller. */
export async function getOrderDetail(orderId: string): Promise<OrderWithDetails | null> {
  const supabase = requireClient();
  const userId = await requireUserId();
  return dedupeRequest(`send2u:order-detail:${userId}:${orderId}`, async () => {
    const { data, error } = await supabase
      .from('send2u_orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw new Error(`Could not load the order: ${error.message}`);
    if (!data) return null;
    return toOrderWithDetails(data as unknown as OrderRow);
  });
}

/** Open job queue: pending/prepared unassigned orders, oldest first. RLS is authoritative. */
export async function listAvailableJobs(): Promise<OrderWithDetails[]> {
  const supabase = requireClient();
  const userId = await requireUserId();
  return dedupeRequest(`send2u:available-jobs:${userId}`, async () => {
    const { data, error } = await supabase
      .from('send2u_orders')
      .select(ORDER_SELECT)
      .in('status', ['pending', 'preparing', 'ready_for_pickup'])
      .is('helper_id', null)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Could not load open jobs: ${error.message}`);
    return (data as unknown as OrderRow[]).map(toOrderWithDetails);
  });
}

/** Single job as visible to the caller (queue or own delivery). Null otherwise. */
export async function getJobDetail(orderId: string): Promise<OrderWithDetails | null> {
  const supabase = requireClient();
  const userId = await requireUserId();
  return dedupeRequest(`send2u:job-detail:${userId}:${orderId}`, async () => {
    const { data, error } = await supabase
      .from('send2u_orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw new Error(`Could not load the job: ${error.message}`);
    if (!data) return null;
    return toOrderWithDetails(data as unknown as OrderRow);
  });
}

/**
 * ACTIVE deliveries assigned to the current helper, newest accepted first.
 * Terminal states are excluded here by the query itself — they live in
 * `listMyDeliveryHistory`. RLS still enforces assignment; this filter
 * enforces the active/history separation.
 */
export async function listMyDeliveries(): Promise<OrderWithDetails[]> {
  const supabase = requireClient();
  const userId = await requireUserId();
  return dedupeRequest(`send2u:my-deliveries:${userId}`, async () => {
    const { data, error } = await supabase
      .from('send2u_orders')
      .select(ORDER_SELECT)
      .eq('helper_id', userId)
      .not('status', 'in', '(completed,cancelled,disputed)')
      .order('accepted_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Could not load your deliveries: ${error.message}`);
    return (data as unknown as OrderRow[]).map(toOrderWithDetails);
  });
}

/**
 * HISTORICAL deliveries assigned to the current helper
 * (completed/cancelled/disputed), newest accepted first. Read-only records.
 * Only the delivery fee counts as earnings; the food is covered by Send2U.
 */
export async function listMyDeliveryHistory(): Promise<OrderWithDetails[]> {
  const supabase = requireClient();
  const userId = await requireUserId();
  return dedupeRequest(`send2u:my-delivery-history:${userId}`, async () => {
    const { data, error } = await supabase
      .from('send2u_orders')
      .select(ORDER_SELECT)
      .eq('helper_id', userId)
      .in('status', ['completed', 'cancelled', 'disputed'])
      .order('accepted_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Could not load your delivery history: ${error.message}`);
    return (data as unknown as OrderRow[]).map(toOrderWithDetails);
  });
}

function toAcceptedSummary(value: unknown): AcceptedOrderSummary {
  if (!isRecord(value)) throw new Error('Accepting the job returned an unexpected result.');
  const { order_id, vendor_id, vendor_name, subtotal_cents, item_count, status, accepted_at, created_at } =
    value;
  if (
    typeof order_id !== 'string' ||
    typeof vendor_id !== 'string' ||
    typeof vendor_name !== 'string' ||
    typeof subtotal_cents !== 'number' ||
    typeof item_count !== 'number' ||
    typeof status !== 'string' ||
    typeof accepted_at !== 'string' ||
    typeof created_at !== 'string'
  ) {
    throw new Error('Accepting the job returned an unexpected result.');
  }
  return {
    orderId: order_id,
    vendorId: vendor_id,
    vendorName: vendor_name,
    subtotalCents: subtotal_cents,
    itemCount: item_count,
    status: status as OrderStatus,
    acceptedAt: accepted_at,
    createdAt: created_at,
  };
}

/**
 * Atomically claims a pending job for the signed-in helper. The database
 * verifies the helper role and the pending state; exactly one claimant wins.
 */
export async function acceptOrder(orderId: string): Promise<AcceptedOrderSummary> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_accept_order', { p_order_id: orderId });
  if (error) throw new Error(friendlyAcceptError(error.message));
  return toAcceptedSummary(data as unknown);
}

/** Maps acceptance guard-rail errors to honest helper-facing messages. */
function friendlyAcceptError(message: string): string {
  if (/not authenticated|session expired/i.test(message))
    return 'Your session expired. Sign in again and retry.';
  if (/only helpers/i.test(message))
    return 'Only verified helpers can accept jobs.';
  if (/active job limit|limit reached/i.test(message))
    return 'You have 3 active jobs. Finish one to take another.';
  if (/no longer available/i.test(message))
    return 'Someone just took this job. Pick another open request.';
  return message ? `Could not accept the job: ${message}` : 'Could not accept the job.';
}

export type FulfilmentAction =
  | 'go_to_vendor'
  | 'arrive'
  | 'report_food_available'
  | 'report_food_unavailable'
  | 'purchase'
  | 'mark_picked_up'
  | 'start_delivery'
  | 'mark_delivered'
  | 'report_failed'
  | 'abandon'
  | 'release';

/**
 * Result of a fulfilment advance. Transaction records are always preserved
 * (cancelled/unavailable orders keep their row for payment history) — every
 * action returns the new status.
 */
export type FulfilmentResult = { status: OrderStatus } | { deleted: true };

/**
 * Advances fulfilment for the assigned helper. The database validates the
 * current state atomically; only valid transitions succeed.
 */
export async function advanceFulfilment(
  orderId: string,
  action: FulfilmentAction,
): Promise<FulfilmentResult> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_helper_advance', {
    p_order_id: orderId,
    p_action: action,
  });
  if (error) throw new Error(friendlyFulfilmentError(error.message));
  if (!isRecord(data)) {
    throw new Error('The update came back in an unexpected shape.');
  }
  if (data.deleted === true) return { deleted: true };
  if (typeof data.status !== 'string') {
    throw new Error('The update came back in an unexpected shape.');
  }
  return { status: data.status as OrderStatus };
}

function friendlyFulfilmentError(message: string): string {
  if (/not authenticated|session expired/i.test(message))
    return 'Your session expired. Sign in again and retry.';
  if (/invalid action|unknown fulfilment/i.test(message))
    return 'That action is not available for the current order state. Refresh and try again.';
  return message ? `Could not update the order: ${message}` : 'Could not update the order.';
}

export interface CancelResult {
  status: OrderStatus;
  /** 'none' — the helper never finances food, so cancellation carries no liability. */
  liability: 'none' | 'food_cost';
  foodCostCents: number | null;
  paymentStatus: PaymentStatus | null;
}

/**
 * Requester cancellation. Records are always preserved for transaction
 * history (cancelled, never deleted). An online payment made before
 * completion is recorded as a simulated refund; otherwise payment ends
 * as cancelled. Late cancellation after the kitchen committed moves to
 * dispute for review — with no food-cost liability, since the helper
 * never pays for food.
 */
export async function cancelOrder(orderId: string, reason: string): Promise<CancelResult> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_cancel_order', {
    p_order_id: orderId,
    p_reason: reason,
  });
  if (error) throw new Error(friendlyCancelError(error.message));
  if (!isRecord(data) || typeof data.status !== 'string' || typeof data.liability !== 'string') {
    throw new Error('Cancellation came back in an unexpected shape.');
  }
  return {
    status: data.status as OrderStatus,
    liability: data.liability === 'food_cost' ? 'food_cost' : 'none',
    foodCostCents:
      typeof data.food_cost_cents === 'number' ? (data.food_cost_cents as number) : null,
    paymentStatus:
      typeof data.payment_status === 'string' ? (data.payment_status as PaymentStatus) : null,
  };
}

function friendlyCancelError(message: string): string {
  if (/not authenticated|session expired/i.test(message))
    return 'Your session expired. Sign in again and retry.';
  if (/order not found/i.test(message)) return 'That order is not available to you.';
  if (/reason required|too long/i.test(message))
    return 'Tell us briefly why you are cancelling (under 500 characters).';
  if (/no longer be cancelled/i.test(message))
    return 'This order can no longer be cancelled. It is already delivered or closed.';
  return message ? `Could not cancel the order: ${message}` : 'Could not cancel the order.';
}

/**
 * Requester confirms the food arrived. Only the owning requester, only from
 * `delivered` — a single atomic UPDATE, so duplicates and concurrent
 * confirms serialize to exactly one winner. When payment is already resolved
 * (online paid or COD collected), the order converges to completed with its
 * settlement recorded in the same flow.
 */
export async function confirmDelivery(orderId: string): Promise<{ status: OrderStatus }> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_confirm_delivery', { p_order_id: orderId });
  if (error) throw new Error(friendlyConfirmError(error.message));
  if (!isRecord(data) || typeof data.status !== 'string') {
    throw new Error('Confirmation came back in an unexpected shape.');
  }
  return { status: data.status as OrderStatus };
}

function friendlyConfirmError(message: string): string {
  if (/not authenticated|session expired/i.test(message))
    return 'Your session expired. Sign in again and retry.';
  if (/order not found/i.test(message)) return 'That order is not available to you.';
  if (/not awaiting confirmation/i.test(message))
    return 'You can confirm once the helper marks the food as delivered.';
  return message ? `Could not confirm delivery: ${message}` : 'Could not confirm delivery.';
}

/** Categories a requester can report a delivered order under. */
export type RequesterDisputeReason = 'not_received' | 'incorrect' | 'damaged' | 'refused';

/**
 * Requester opens a delivery dispute. Only the owning requester, only from
 * `delivered` (pre-payment, so payment history can never overlap a dispute) —
 * a single atomic UPDATE, so duplicates and concurrent opens serialize to
 * exactly one winner. Details are the opener's account, preserved separately
 * from any later admin resolution note. No money moves.
 */
export async function openDispute(
  orderId: string,
  reason: RequesterDisputeReason,
  details: string | null,
): Promise<{ status: OrderStatus }> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_open_dispute', {
    p_order_id: orderId,
    p_reason: reason,
    p_details: details,
  });
  if (error) throw new Error(friendlyDisputeError(error.message, 'report'));
  if (!isRecord(data) || typeof data.status !== 'string') {
    throw new Error('The report came back in an unexpected shape.');
  }
  return { status: data.status as OrderStatus };
}

/**
 * Requester retracts their OWN delivery report, resuming at `delivered`.
 * Helper-caused disputes are excluded server-side. A retraction clears the
 * open claim (it resumes truthfully); the resumed flow records what follows.
 */
export async function withdrawDispute(orderId: string): Promise<{ status: OrderStatus }> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_withdraw_dispute', { p_order_id: orderId });
  if (error) throw new Error(friendlyDisputeError(error.message, 'withdraw'));
  if (!isRecord(data) || typeof data.status !== 'string') {
    throw new Error('The withdrawal came back in an unexpected shape.');
  }
  return { status: data.status as OrderStatus };
}

function friendlyDisputeError(message: string, action: 'report' | 'withdraw'): string {
  if (/not authenticated|session expired/i.test(message))
    return 'Your session expired. Sign in again and retry.';
  if (/order not found/i.test(message)) return 'That order is not available to you.';
  if (/invalid dispute reason/i.test(message)) return 'Choose what went wrong with the delivery.';
  if (/too long/i.test(message)) return 'Keep the details under 500 characters.';
  if (/only delivered/i.test(message))
    return 'You can report a problem once the food is marked delivered.';
  if (/cannot be withdrawn/i.test(message))
    return 'This report can no longer be withdrawn.';
  const verb = action === 'report' ? 'report the problem' : 'withdraw the report';
  return message ? `Could not ${verb}: ${message}` : `Could not ${verb}.`;
}

/** Maps database guard-rail errors to honest requester-facing messages. */
function friendlyOrderError(message: string): string {
  if (/not authenticated/i.test(message)) return 'Your session expired. Sign in again and retry.';
  if (/delivery location/i.test(message))
    return 'That delivery location is no longer available. Pick another one and retry.';
  if (/cart is empty|invalid cart/i.test(message))
    return 'Your cart looks invalid. Review it and try again.';
  if (/unavailable/i.test(message))
    return 'One or more items just became unavailable. Refresh the menu and try again.';
  return message ? `Could not place your request: ${message}` : 'Could not place your request.';
}
