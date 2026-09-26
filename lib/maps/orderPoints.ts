import { isValidLatLng } from '@/lib/maps/geo';
import type { LatLng } from '@/lib/maps/types';
import type { OrderStatus, OrderWithDetails } from '@/types/domain';

/**
 * Where a delivery's map points come from, and which one is the destination.
 *
 * This is the one place that answers "what is the helper driving to right now",
 * derived from the existing order status vocabulary in `lib/orders.ts`. No new
 * statuses exist for the map, and no phase is invented: a status this file does
 * not recognise yields no destination rather than a guess, which is how the map
 * ends up with nothing to draw instead of something wrong.
 *
 * Coordinates are only ever read from the backend columns real users filled in
 * (`vendors.pickup_lat/lng`, `delivery_locations.lat/lng`). A missing pin means
 * that marker simply does not exist.
 */

export type DeliveryPhase =
  /** Before the food is in hand: the destination is the vendor. */
  | 'to-vendor'
  /** After pickup: the destination is the requester's drop-off point. */
  | 'to-requester'
  /** Nothing left to navigate to. */
  | 'none';

/** Statuses whose destination is the vendor, from the existing lifecycle. */
const TO_VENDOR_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'assigned',
  'accepted',
  'going_to_vendor',
  'at_vendor',
  'food_available',
  'food_purchased',
  'ready_for_pickup',
]);

/** Statuses whose destination is the drop-off point. */
const TO_REQUESTER_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'picked_up',
  'out_for_delivery',
  'delivering',
  'awaiting_requester_payment',
  'delivered',
]);

/** Terminal statuses: tracking is over, whatever the map last showed. */
const COMPLETE_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'completed',
  'cancelled',
  'disputed',
]);

export function deliveryPhase(status: OrderStatus): DeliveryPhase {
  if (TO_VENDOR_STATUSES.has(status)) return 'to-vendor';
  if (TO_REQUESTER_STATUSES.has(status)) return 'to-requester';
  return 'none';
}

/** True while live location sharing belongs to this order. */
export function isTrackingPhase(status: OrderStatus): boolean {
  return deliveryPhase(status) !== 'none' && !COMPLETE_STATUSES.has(status);
}

export function isComplete(status: OrderStatus): boolean {
  return COMPLETE_STATUSES.has(status);
}

export interface OrderMapGeometry {
  phase: DeliveryPhase;
  /** Vendor pickup pin, when the vendor has set one. */
  vendor: LatLng | null;
  /** Requester drop-off pin, when that location has one. */
  dropoff: LatLng | null;
  /** Where the route should end right now, or null when that pin is missing. */
  destination: { coordinate: LatLng; label: string; kind: 'vendor' | 'dropoff' } | null;
}

function toLatLng(lat: number | null, lng: number | null): LatLng | null {
  if (lat === null || lng === null) return null;
  const candidate = { latitude: lat, longitude: lng };
  return isValidLatLng(candidate) ? candidate : null;
}

export function orderMapGeometry(order: OrderWithDetails): OrderMapGeometry {
  const phase = deliveryPhase(order.status);
  const vendor = toLatLng(order.vendor.pickupLat, order.vendor.pickupLng);
  const dropoff = toLatLng(order.location.lat, order.location.lng);

  if (phase === 'to-vendor') {
    return {
      phase,
      vendor,
      dropoff,
      destination: vendor
        ? { coordinate: vendor, label: order.vendor.name, kind: 'vendor' }
        : null,
    };
  }
  if (phase === 'to-requester') {
    return {
      phase,
      vendor,
      dropoff,
      destination: dropoff
        ? { coordinate: dropoff, label: order.location.name, kind: 'dropoff' }
        : null,
    };
  }
  return { phase, vendor, dropoff, destination: null };
}

/**
 * Identity of the current journey, for the route hook's recalculation gate.
 * It changes when the destination point changes or the phase flips — and for no
 * other reason, so a GPS fix can never invalidate a live route.
 */
export function routeDestinationKey(order: OrderWithDetails): string {
  const geometry = orderMapGeometry(order);
  if (!geometry.destination) return `${order.status}:no-destination`;
  const { latitude, longitude } = geometry.destination.coordinate;
  return `${geometry.destination.kind}:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}
