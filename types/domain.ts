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
  /** Legacy helper-QR storage path (retired flow); always null for new code. */
  paymentQrPath: string | null;
  /** Helper availability — only meaningful when role is helper. */
  isAvailable: boolean;
  availabilityUpdatedAt: string | null;
  /** Linked stall for vendor accounts (service-role provisioned); null otherwise. */
  vendorId: string | null;
  /** Helper Portal capability for requesters. Granted manually out-of-band;
   * never settable from the app (guarded server-side like is_dev_account). */
  isVerifiedHelper: boolean;
  /** Admin-flagged development/test account. Never settable from the app. */
  isDevAccount: boolean;
  /** Optional dev label (seeded out-of-band). Never PII or auth data. */
  displayName: string | null;
  /** Editable requester identity (Edit Profile). Nullable until set. */
  fullName: string | null;
  studentId: string | null;
  phoneNumber: string | null;
  /** Storage path of the profile photo (`avatar/<uid>/…`), null when unset. */
  avatarPath: string | null;
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
  /** Verified Helper Portal capability (requester + flag). Never mutually exclusive with requester. */
  isVerifiedHelper: boolean;
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
  /** Free-text hint; still what the external maps handoff searches for. */
  locationHint: string | null;
  /**
   * Pickup pin placed by the vendor on their own device. Null until then, and
   * no code may substitute a guess while it is missing.
   */
  pickupLat: number | null;
  pickupLng: number | null;
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
  /**
   * Drop-off pin, placed once by the requester who chooses this spot. Null
   * until then, and no code may substitute a guess while it is missing.
   */
  lat: number | null;
  lng: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fulfilment lifecycle. Happy path: pending → assigned → preparing →
 * ready_for_pickup → going_to_vendor → at_vendor → food_available →
 * food_purchased → picked_up → out_for_delivery → delivered → confirmed →
 * completed. The cafeteria prepares platform-covered orders; the helper
 * never finances food. Legacy values stay reserved but unused by current flows.
 */
export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'preparing'
  | 'ready_for_pickup'
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
  | 'confirmed';

/**
 * One vendor fulfilment managed by Send2U. The platform records the
 * transaction; the cafeteria prepares the food and the helper delivers it.
 * The helper never finances food — `foodCostCents` is Send2U's covered-cost
 * record (food subtotal snapshot at collection), not a fronted expense.
 * Order status, payment status, and settlement status evolve independently.
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
  /** How this order is paid: platform-simulated online or cash on delivery. */
  paymentMethod: PaymentMethod | null;
  /** Independent payment state (see PaymentStatus). */
  paymentStatus: PaymentStatus;
  /** Independent settlement state (see SettlementStatus). */
  settlementStatus: SettlementStatus;
  /** When an online payment succeeded; null otherwise. */
  paidAt: string | null;
  /** COD cash due from the customer (= subtotal + fee); null for online. */
  codExpectedCents: number | null;
  /** COD cash recorded as collected; null until collected. */
  codCollectedCents: number | null;
  codCollectedAt: string | null;
  settledAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
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
  /** Snapshot of the platform-covered food cost (= subtotal at collection). */
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
  vendor: Pick<Vendor, 'id' | 'name' | 'locationHint' | 'pickupLat' | 'pickupLng'>;
  location: Pick<DeliveryLocation, 'id' | 'name' | 'description' | 'lat' | 'lng'>;
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
  paymentMethod: PaymentMethod | null;
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
 * How the requester pays. Online is a simulated in-app platform payment
 * (competition prototype — no real money moves); COD is cash handed to the
 * helper on delivery and recorded by Send2U. Never helper QR transfers.
 */
export type PaymentMethod = 'online' | 'cod';

/**
 * Independent payment state, separate from order fulfilment status.
 * Online: unpaid → pending → paid | failed (→ pending on retry) → refunded.
 * COD: unpaid → collected (→ refunded where applicable).
 * Cancelled orders end at cancelled (or refunded when money was recorded).
 */
export type PaymentStatus =
  | 'submitted'
  | 'verified'
  | 'rejected'
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'collected'
  | 'not_collected'
  | 'refunded'
  | 'refund_pending'
  | 'cancelled';

/** Independent settlement state for the platform accounting record. */
export type SettlementStatus = 'pending' | 'settled' | 'failed' | 'reversed';

export interface Payment {
  orderId: string;
  amountCents: number;
  /** Legacy receipt path (old QR flow); null for platform transactions. */
  evidencePath: string | null;
  status: PaymentStatus;
  method: PaymentMethod | null;
  /** Simulated provider reference (e.g. SIM-…); null for COD/unstarted. */
  providerRef: string | null;
  attemptCount: number;
  lastError: string | null;
  submittedAt: string;
  paidAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Simulated settlement split for one order (accounting only — no real
 * money movement). Vendor gets the food subtotal minus platform commission,
 * the helper earns the delivery fee, and the platform takes its configured
 * share (RM0 in the competition prototype).
 */
export interface Settlement {
  orderId: string;
  vendorAmountCents: number;
  helperAmountCents: number;
  platformAmountCents: number;
  commissionBps: number;
  status: SettlementStatus;
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
 * not live state. Only completed orders with a recorded payment
 * (paid/collected) are rateable.
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
