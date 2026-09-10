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
 * Requester order status. Only `pending` is created by the current MVP;
 * the rest are reserved for helper assignment, fulfilment, and confirmation.
 */
export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'confirmed'
  | 'cancelled';

/**
 * One vendor fulfilment. A mixed-vendor cart splits into one order per
 * vendor sharing the same delivery location. No payment/helper fields yet.
 */
export interface Order {
  id: string;
  requesterId: string;
  vendorId: string;
  deliveryLocationId: string;
  status: OrderStatus;
  /** Sum of unit price × quantity in MYR cents. No fees or taxes. */
  subtotalCents: number;
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

/** Payments are out of scope for the skeleton — shape only. */
export interface Payment {
  id: string;
  orderId: string;
  amountCents: number;
  status: 'pending' | 'held' | 'released' | 'failed';
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
