import { getSupabaseClient } from '@/lib/supabase';
import type { JobOffer, OfferStatus, OrderWithDetails } from '@/types/domain';

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

const OFFER_ORDER_SELECT =
  'id, order_id, helper_id, status, created_at, expires_at, responded_at,' +
  ' order:send2u_orders!inner(id, requester_id, vendor_id, delivery_location_id, status, subtotal_cents, delivery_fee_cents, pickup_code, helper_id, accepted_at, going_to_vendor_at, arrived_at, food_available_at, purchased_at, food_cost_cents, picked_up_at, out_for_delivery_at, delivered_at, confirmed_at, cancelled_at, cancelled_by, cancel_reason, dispute_reason, dispute_details, dispute_note, disputed_at, resolved_at, resolution, created_at, updated_at, vendor:send2u_vendors!inner(id, name, location_hint), delivery_location:send2u_delivery_locations!inner(id, name), send2u_order_items(id, order_id, menu_item_id, item_name, unit_price_cents, quantity, line_total_cents, created_at), send2u_payments(order_id, amount_cents, evidence_path, status, submitted_at, verified_at))';

export async function listMyOffers(): Promise<JobOffer[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_job_offers')
    .select(OFFER_ORDER_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Could not load offers: ${error.message}`);
  // Map with order details via helper
  return (data as unknown as any[]).map((r) => {
    // The offer row's order is nested; we need to map order details to Offer's order field using same logic as orders service
    // Simplify: construct order via inline mapping similar to toOrderWithDetails but reuse raw
    const offer: JobOffer = {
      id: r.id,
      orderId: r.order_id,
      helperId: r.helper_id,
      status: r.status as OfferStatus,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      respondedAt: r.responded_at,
      order: null,
    };
    if (r.order) {
      try {
        // Attempt to build OrderWithDetails from nested order
        const or = r.order;
        // or may have vendor and location already
        offer.order = {
          id: or.id,
          requesterId: or.requester_id,
          vendorId: or.vendor_id,
          deliveryLocationId: or.delivery_location_id,
          status: or.status,
          subtotalCents: or.subtotal_cents,
          deliveryFeeCents: or.delivery_fee_cents,
          pickupCode: or.pickup_code,
          helperId: or.helper_id,
          acceptedAt: or.accepted_at,
          goingToVendorAt: or.going_to_vendor_at,
          arrivedAt: or.arrived_at,
          foodAvailableAt: or.food_available_at,
          purchasedAt: or.purchased_at,
          foodCostCents: or.food_cost_cents,
          pickedUpAt: or.picked_up_at,
          outForDeliveryAt: or.out_for_delivery_at,
          deliveredAt: or.delivered_at,
          confirmedAt: or.confirmed_at,
          cancelledAt: or.cancelled_at,
          cancelledBy: or.cancelled_by,
          cancelReason: or.cancel_reason,
          disputeReason: or.dispute_reason,
          disputeDetails: or.dispute_details,
          disputeNote: or.dispute_note,
          disputedAt: or.disputed_at,
          resolvedAt: or.resolved_at,
          resolution: or.resolution,
          createdAt: or.created_at,
          updatedAt: or.updated_at,
          vendor: or.vendor ? { id: or.vendor.id, name: or.vendor.name, locationHint: or.vendor.location_hint } : { id: '', name: '', locationHint: null },
          location: or.delivery_location ? { id: or.delivery_location.id, name: or.delivery_location.name } : { id: '', name: '' },
          items: (or.send2u_order_items ?? []).map((i: any) => ({
            id: i.id,
            orderId: i.order_id,
            menuItemId: i.menu_item_id,
            itemName: i.item_name,
            unitPriceCents: i.unit_price_cents,
            quantity: i.quantity,
            lineTotalCents: i.line_total_cents,
            createdAt: i.created_at,
          })),
          payment: (() => {
            const p = or.send2u_payments;
            const arr = !p ? [] : Array.isArray(p) ? p : [p];
            const first = arr[0];
            if (!first) return null;
            return {
              orderId: or.id,
              amountCents: first.amount_cents,
              evidencePath: first.evidence_path,
              status: first.status,
              submittedAt: first.submitted_at,
              verifiedAt: first.verified_at,
              createdAt: first.submitted_at,
              updatedAt: first.verified_at ?? first.submitted_at,
            };
          })(),
        } as OrderWithDetails;
      } catch {
        offer.order = null;
      }
    }
    return offer;
  });
}

export async function respondToOffer(offerId: string, action: 'accepted' | 'rejected'): Promise<{ status: string }> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_respond_to_offer', { p_offer_id: offerId, p_action: action });
  if (error) throw new Error(friendlyError(error.message));
  if (!isRecord(data) || typeof data.status !== 'string') throw new Error('Unexpected offer response');
  const status = data.status as string;
  if (status === 'expired') throw new Error('Offer expired');
  if (status === 'not_available') throw new Error('You are not available');
  if (status === 'order_unavailable') throw new Error('Order is no longer available');
  return { status };
}

export async function expirePendingOffers(): Promise<{ expired: number }> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_expire_pending_offers');
  if (error) throw new Error(`Could not check offers: ${error.message}`);
  if (!isRecord(data) || typeof data.expired !== 'number') return { expired: 0 };
  return { expired: data.expired as number };
}

function friendlyError(msg: string): string {
  if (/not authenticated/i.test(msg)) return 'Your session expired. Sign in again.';
  if (/Not your offer/i.test(msg)) return 'This offer is not for you.';
  if (/no longer available|Offer no longer/i.test(msg)) return 'This offer is no longer available.';
  if (/expired/i.test(msg)) return 'This offer has expired.';
  if (/no longer available/i.test(msg)) return 'This order is no longer available.';
  if (/not available/i.test(msg)) return 'You are not available.';
  return msg ? `Could not update offer: ${msg}` : 'Could not update offer.';
}
