import { getSupabaseClient } from '@/lib/supabase';
import type {
  OrderItem,
  OrderStatus,
  OrderWithDetails,
  PlaceOrderLine,
  PlacedOrderSummary,
} from '@/types/domain';

/**
 * Order service layer.
 *
 * Creation goes exclusively through the `send2u_place_orders` database
 * function: the client sends only menu-item ids + quantities, and the
 * database derives prices, snapshots, vendor split, subtotals, requester,
 * and status server-side in one transaction. There are deliberately no
 * direct table-write functions here — clients hold SELECT-only grants.
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

interface OrderRow {
  id: string;
  requester_id: string;
  vendor_id: string;
  delivery_location_id: string;
  status: string;
  subtotal_cents: number;
  created_at: string;
  updated_at: string;
  vendor: { id: string; name: string; location_hint: string | null } | null;
  delivery_location: { id: string; name: string } | null;
  send2u_order_items: OrderItemRow[] | null;
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
  if (!row.vendor || !row.delivery_location) {
    throw new Error('Order references data that is no longer visible.');
  }
  return {
    id: row.id,
    requesterId: row.requester_id,
    vendorId: row.vendor_id,
    deliveryLocationId: row.delivery_location_id,
    status: row.status as OrderStatus,
    subtotalCents: row.subtotal_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vendor: {
      id: row.vendor.id,
      name: row.vendor.name,
      locationHint: row.vendor.location_hint,
    },
    location: { id: row.delivery_location.id, name: row.delivery_location.name },
    items: (row.send2u_order_items ?? []).map(toOrderItem),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toPlacedSummary(value: unknown): PlacedOrderSummary {
  if (!isRecord(value)) throw new Error('Order creation returned an unexpected result.');
  const { order_id, vendor_id, vendor_name, subtotal_cents, item_count, status, created_at } = value;
  if (
    typeof order_id !== 'string' ||
    typeof vendor_id !== 'string' ||
    typeof vendor_name !== 'string' ||
    typeof subtotal_cents !== 'number' ||
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
    itemCount: item_count,
    status: status as OrderStatus,
    createdAt: created_at,
  };
}

const ORDER_SELECT =
  'id, requester_id, vendor_id, delivery_location_id, status, subtotal_cents, created_at, updated_at,' +
  ' vendor:send2u_vendors!inner(id, name, location_hint),' +
  ' delivery_location:send2u_delivery_locations!inner(id, name),' +
  ' send2u_order_items(id, order_id, menu_item_id, item_name, unit_price_cents, quantity, line_total_cents, created_at)';

/**
 * Places the cart: one order per vendor sharing the delivery location.
 * Prices and snapshots come from the database — the `lines` carry ids and
 * quantities only, so requester-supplied totals are never trusted.
 */
export async function placeOrders(
  deliveryLocationId: string,
  lines: PlaceOrderLine[],
): Promise<PlacedOrderSummary[]> {
  const supabase = requireClient();
  if (lines.length === 0) throw new Error('Your cart is empty.');
  const { data, error } = await supabase.rpc('send2u_place_orders', {
    p_delivery_location_id: deliveryLocationId,
    p_items: lines.map((line) => ({ menu_item_id: line.menuItemId, quantity: line.quantity })),
  });
  if (error) throw new Error(friendlyOrderError(error.message));
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Order creation returned an unexpected result.');
  }
  return (data as unknown[]).map(toPlacedSummary);
}

/** Requester's own orders, newest first, with item snapshots. */
export async function listMyOrders(): Promise<OrderWithDetails[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load your orders: ${error.message}`);
  return (data as unknown as OrderRow[]).map(toOrderWithDetails);
}

/** Single own order with snapshots. Null when not visible to the caller. */
export async function getOrderDetail(orderId: string): Promise<OrderWithDetails | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the order: ${error.message}`);
  if (!data) return null;
  return toOrderWithDetails(data as unknown as OrderRow);
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
