/**
 * Minimal domain types for the Send2U MVP skeleton.
 *
 * These are intentionally small. They establish vocabulary for the future
 * transaction lifecycle without implementing the transaction engine:
 *
 * request → assignment → fulfilment → verification → confirmation → payout
 */

export type UserRole = 'requester' | 'helper';

/**
 * Roles stored in `send2u_profiles.role`. Supabase Auth owns identity;
 * the profile row owns the Send2U role. Extensible to vendor/admin later.
 */
export type ProfileRole = 'requester' | 'helper' | 'vendor' | 'admin';

export interface Profile {
  id: string;
  role: ProfileRole;
  /** Storage path of the helper's payment QR (`qr/<uid>/…`), null when unset. */
  paymentQrPath: string | null;
  createdAt: string;
  updatedAt: string;
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
  vendor: Pick<Vendor, 'id' | 'name' | 'locationHint' | 'isOpen'>;
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
 * delivered → awaiting_requester_payment → completed.
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
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  disputeReason: string | null;
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
 * from the order subtotal at submit time — never supplied by the client.
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

/** Ratings are out of scope for the skeleton — shape only. */
export interface Rating {
  id: string;
  orderId: string;
  fromUserId: string;
  toUserId: string;
  score: number;
  comment?: string;
}
