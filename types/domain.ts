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

export interface Vendor {
  id: string;
  name: string;
  locationDescription?: string;
  isOpen?: boolean;
}

export interface MenuItem {
  id: string;
  vendorId: string;
  name: string;
  priceCents: number;
}

export interface DeliveryLocation {
  id: string;
  label: string;
  detail?: string;
}

/**
 * Order lifecycle for the MVP skeleton.
 * Full fulfilment / verification / payout logic comes later.
 */
export type OrderStage =
  | 'request'
  | 'assignment'
  | 'fulfilment'
  | 'verification'
  | 'confirmation'
  | 'payout';

export type OrderStatus =
  | 'draft'
  | 'requested'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered_pending_verification'
  | 'confirmed'
  | 'paid_out'
  | 'cancelled';

export interface Order {
  id: string;
  requesterId: string;
  helperId?: string | null;
  vendorId: string;
  stage: OrderStage;
  status: OrderStatus;
  pickupLocationId?: string | null;
  dropoffLocationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Delivery is the helper-facing view of an order fulfilment. Placeholder only. */
export interface Delivery {
  id: string;
  orderId: string;
  helperId: string;
  status: Extract<OrderStatus, 'assigned' | 'picked_up' | 'in_transit' | 'delivered_pending_verification' | 'confirmed'>;
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
