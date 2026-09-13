/**
 * Minimal domain types for the Send2U MVP skeleton.
 *
 * These are intentionally small. They establish vocabulary for the future
 * transaction lifecycle without implementing the transaction engine:
 *
 * request → assignment → fulfilment → verification → confirmation → payout
 */

export type UserRole = 'requester' | 'helper' | 'vendor';

/** Roles stored in `send2u_profiles.role`. Supabase Auth owns identity;
 * the profile row owns the Send2U role. `vendor` accounts are provisioned
 * out-of-band and linked to exactly one stall via `vendor_id`. */
export type ProfileRole = 'requester' | 'helper' | 'vendor' | 'admin';

export interface Profile {
  id: string;
  /** Permanent account role, set once at signup. Never mutated afterwards. */
  role: ProfileRole;
  /** Storage path of the helper's payment QR (`qr/<uid>/…`), null when unset. */
  paymentQrPath: string | null;
  /** Helper availability — only meaningful when role is helper. */
  isAvailable: boolean;
  availabilityUpdatedAt: string | null;
  /** Linked stall for vendor accounts (service-role provisioned); null otherwise. */
  vendorId: string | null;
  /** Admin-flagged development/test account. Never settable from the app. */
  isDevAccount: boolean;
  /** Optional dev label (seeded out-of-band). Never PII or auth data. */
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface JobOffer {
  id: string;
  orderId: string;
  helperId: string;
  status: OfferStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  order: OrderWithDetails | null;
}

export interface AppUser {
  id: string;
  /** Null for anonymous sessions (no email identity linked yet). */
  email: string | null;
  role: UserRole | null;
  isAnonymous: boolean;
  displayName?: string | null;
  universityId?: string | null;
}

/** Alias kept for future requester-specific profile fields. */
export interface Requester extends AppUser {
  role: 'requester';
}

/** Alias kept for future helper-specific profile fields. */
export interface Helper extends AppUser {
  role: 'helper';
  isVerifiedStudent?: boolean;
}

/** Cafeteria stall. One active menu per vendor for the MVP (no menus table). */
export interface Vendor {
  id: string;
  name: string;
  description: string | null;
  locationHint: string | null;
  /** Free-text operating hours (e.g. "Mon–Fri 9am–5pm"). Display only. */
  operatingHours: string | null;
  /** Storage path/URL for a future vendor image. Unused in MVP. */
  imageUrl: string | null;
  isActive: boolean;
  isOpen: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  /** Price in Malaysian Ringgit cents (e.g. 650 = RM 6.50). */
  priceCents: number;
  /** Storage path/URL for a future item image. Unused in MVP. */
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Menu item with its vendor joined — what the requester UI renders. */
export interface MenuItemWithVendor extends MenuItem {
  vendor: Pick<Vendor, 'id' | 'name' | 'description' | 'locationHint' | 'operatingHours' | 'isOpen'>;
}

/** One vendor section on the requester menu. */
export interface VendorMenuSection {
  vendor: Vendor;
  items: MenuItemWithVendor[];
}

/** Local in-memory cart line. Submitted to Supabase via `placeOrders`; never persisted. */
export interface CartLine {
  item: MenuItemWithVendor;
  quantity: number;
}

/** Predefined campus drop-off point. Requesters pick from this list. */
export interface DeliveryLocation {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fulfilment lifecycle. Happy path: pending → assigned → going_to_vendor →
 * at_vendor → food_available → food_purchased → picked_up → out_for_delivery →
 * delivered → confirmed (requester confirms receipt) →
 * awaiting_requester_payment → completed.
 * Exception states: cancelled (clean) and disputed (needs settlement).
 * Legacy values stay reserved but unused by current flows.
 */
export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'going_to_vendor'
  | 'at_vendor'
  | 'food_available'
  | 'food_purchased'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivering'
  | 'delivered'
  | 'awaiting_requester_payment'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'confirmed';

/**
 * One vendor fulfilment. The helper fronts the food cost at the physical
 * stall; the requester later pays food + delivery fee externally.
 * No payment/helper fields yet beyond assignment. No money moves in-app.
 */
export interface Order {
  id: string;
  requesterId: string;
  vendorId: string;
  deliveryLocationId: string;
  status: OrderStatus;
  /** Food sum (unit × qty) in MYR cents. No fees or taxes. */
  subtotalCents: number;
  /** Prototype delivery fee in cents; the helper's earning when completed. */
  deliveryFeeCents: number;
  /** Vendor-handoff reference, verified by the helper at pickup. */
  pickupCode: string;
  /** Assigned helper once accepted; null while pending. */
  helperId: string | null;
  /** When the helper accepted; null while pending. */
  acceptedAt: string | null;
  goingToVendorAt: string | null;
  arrivedAt: string | null;
  foodAvailableAt: string | null;
  purchasedAt: string | null;
  /** Snapshot of the fronted food cost (= subtotal at purchase). */
  foodCostCents: number | null;
  /** When pickup verification succeeded; null until verified. */
  pickedUpAt: string | null;
  /** When the delivery run started; null until started. */
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  /** When the requester confirmed receipt; null until confirmed. */
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  disputeReason: string | null;
  /** The opener's free-text account; preserved alongside any admin note. */
  disputeDetails: string | null;
  /** Admin resolution note written by `send2u_resolve_dispute`, if any. */
  disputeNote: string | null;
  disputedAt: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Immutable purchase snapshot — survives later menu name/price changes. */
export interface OrderItem {
  id: string;
  orderId: string;
  /** Null when the menu item was deleted after ordering; snapshot remains. */
  menuItemId: string | null;
  itemName: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  createdAt: string;
}

/** Order with its vendor, location, and item snapshots for requester UI. */
export interface OrderWithDetails extends Order {
  vendor: Pick<Vendor, 'id' | 'name' | 'locationHint'>;
  location: Pick<DeliveryLocation, 'id' | 'name'>;
  items: OrderItem[];
  /** Latest payment row when visible to the caller; null when unpaid/hidden. */
  payment: Payment | null;
}

/** One line of the cart as sent to `send2u_place_orders` (ids only). */
export interface PlaceOrderLine {
  menuItemId: string;
  quantity: number;
}

/** Per-vendor result returned by `send2u_place_orders`. */
export interface PlacedOrderSummary {
  orderId: string;
  vendorId: string;
  vendorName: string;
  subtotalCents: number;
  /** Fixed RM2.00 delivery fee recorded server-side per order. */
  deliveryFeeCents: number;
  itemCount: number;
  status: OrderStatus;
  createdAt: string;
}

/** Result returned by `send2u_accept_order` after an atomic claim. */
export interface AcceptedOrderSummary {
  orderId: string;
  vendorId: string;
  vendorName: string;
  subtotalCents: number;
  itemCount: number;
  status: OrderStatus;
  acceptedAt: string;
  createdAt: string;
}

/**
 * External-payment state. No row means not submitted. Amount is snapshotted
 * as food subtotal + delivery fee at submit time — never supplied by the
 * client. It is the full receipt amount, NOT the helper's earning (which
 * is the delivery fee alone).
 */
export type PaymentStatus = 'submitted' | 'verified' | 'rejected';

export interface Payment {
  orderId: string;
  amountCents: number;
  evidencePath: string;
  status: PaymentStatus;
  submittedAt: string;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Order lifecycle stages for the MVP skeleton (high-level journey).
 * Full fulfilment / verification / payout logic comes later.
 */
export type OrderStage =
  | 'request'
  | 'assignment'
  | 'fulfilment'
  | 'verification'
  | 'confirmation'
  | 'payout';

/** Delivery is the helper-facing view of an order fulfilment. Placeholder only. */
export interface Delivery {
  id: string;
  orderId: string;
  helperId: string;
  status: Extract<OrderStatus, 'assigned' | 'picked_up' | 'delivering' | 'delivered' | 'confirmed'>;
}

/**
 * Two-sided trust record for one completed order. At most one row per party
 * per order (requester→helper and helper→requester), written once through
 * `send2u_submit_rating` and never modified afterwards — ratings are history,
 * not live state. Only orders with a verified payment are rateable.
 */
export interface Rating {
  id: string;
  orderId: string;
  fromUserId: string;
  toUserId: string;
  /** 1–5 inclusive, validated server-side. */
  score: number;
  /** Optional free text, trimmed server-side; null when omitted. */
  comment: string | null;
  createdAt: string;
}
