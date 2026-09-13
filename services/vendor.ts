import { getSupabaseClient } from '@/lib/supabase';
import type { MenuItem, Vendor } from '@/types/domain';

/**
 * Vendor self-management service layer (Option A: stall + menu only).
 *
 * Writes go exclusively through SECURITY DEFINER RPCs that derive the
 * caller's linked stall server-side — the client sends data only, never
 * ids it shouldn't choose. There are no client write policies/grants on
 * vendors or menu items. Reads of the own stall use the owner SELECT
 * policies. Vendors never touch orders, payments, or other stalls.
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

interface VendorRow {
  id: string;
  name: string;
  description: string | null;
  location_hint: string | null;
  operating_hours: string | null;
  image_url: string | null;
  is_active: boolean;
  is_open: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface MenuItemRow {
  id: string;
  vendor_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    locationHint: row.location_hint,
    operatingHours: row.operating_hours,
    imageUrl: row.image_url,
    isActive: row.is_active,
    isOpen: row.is_open,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    imageUrl: row.image_url,
    isAvailable: row.is_available,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Linked stall id for the signed-in vendor. Throws when none is linked. */
async function requireLinkedVendorId(): Promise<string> {
  const supabase = requireClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Could not load your stall: ${sessionError.message}`);
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Your session expired. Sign in again and retry.');
  const { data: profile, error: profileError } = await supabase
    .from('send2u_profiles')
    .select('role, vendor_id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw new Error(`Could not load your stall: ${profileError.message}`);
  const row = profile as { role?: unknown; vendor_id?: unknown } | null;
  if (!row || row.role !== 'vendor' || typeof row.vendor_id !== 'string' || row.vendor_id.length === 0) {
    throw new Error('No stall is linked to this account. Ask your administrator to link one.');
  }
  return row.vendor_id;
}

/** The signed-in vendor's own stall. Throws when none is linked. */
export async function getMyVendor(): Promise<Vendor> {
  const supabase = requireClient();
  const vendorId = await requireLinkedVendorId();
  const { data, error } = await supabase
    .from('send2u_vendors')
    .select(
      'id, name, description, location_hint, operating_hours, image_url, is_active, is_open, sort_order, created_at, updated_at',
    )
    .eq('id', vendorId)
    .maybeSingle();
  if (error) throw new Error(`Could not load your stall: ${error.message}`);
  if (!data) throw new Error('Your linked stall is no longer available. Ask your administrator.');
  return toVendor(data as VendorRow);
}

export interface VendorProfileInput {
  name: string;
  description: string | null;
  locationHint: string | null;
  operatingHours: string | null;
  isOpen: boolean;
}

/** Updates the own stall profile. Server re-validates everything. */
export async function updateVendorProfile(input: VendorProfileInput): Promise<Vendor> {
  const supabase = requireClient();
  const name = input.name.trim();
  if (name.length === 0) throw new Error('Stall name is required.');
  const { error } = await supabase.rpc('send2u_update_vendor_profile', {
    p_name: name,
    p_description: input.description?.trim() ? input.description.trim() : null,
    p_location_hint: input.locationHint?.trim() ? input.locationHint.trim() : null,
    p_operating_hours: input.operatingHours?.trim() ? input.operatingHours.trim() : null,
    p_is_open: input.isOpen,
  });
  if (error) throw new Error(error.message ? `Could not save your stall: ${error.message}` : 'Could not save your stall.');
  return getMyVendor();
}

/** The signed-in vendor's own menu items, in display order. */
export async function listMyMenuItems(): Promise<MenuItem[]> {
  const supabase = requireClient();
  const vendorId = await requireLinkedVendorId();
  const { data, error } = await supabase
    .from('send2u_menu_items')
    .select(
      'id, vendor_id, name, description, price_cents, image_url, is_available, sort_order, created_at, updated_at',
    )
    .eq('vendor_id', vendorId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(`Could not load your menu: ${error.message}`);
  return ((data ?? []) as MenuItemRow[]).map(toMenuItem);
}

export interface MenuItemInput {
  name: string;
  description: string | null;
  /** Price in MYR cents (use parsePriceToCents for user input). */
  priceCents: number;
  isAvailable: boolean;
}

/** Creates (no itemId) or updates (itemId) an own-stall menu item. */
export async function upsertMenuItem(itemId: string | null, input: MenuItemInput): Promise<MenuItem> {
  const supabase = requireClient();
  const name = input.name.trim();
  if (name.length === 0) throw new Error('Item name is required.');
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
    throw new Error('Enter a valid price of RM 0.00 or more.');
  }
  const { data, error } = await supabase.rpc('send2u_upsert_menu_item', {
    p_item_id: itemId,
    p_name: name,
    p_description: input.description?.trim() ? input.description.trim() : null,
    p_price_cents: input.priceCents,
    p_is_available: input.isAvailable,
    p_sort_order: 0,
  });
  if (error) throw new Error(error.message ? `Could not save the item: ${error.message}` : 'Could not save the item.');
  if (!isRecord(data) || typeof data.id !== 'string') {
    throw new Error('Saving came back in an unexpected shape.');
  }
  return toMenuItem(data as unknown as MenuItemRow);
}

/**
 * Deletes an own-stall menu item. Safe for history by construction: past
 * order items keep their name/price snapshots and their menu-item link is
 * SET NULL, so existing orders never change.
 */
export async function deleteMenuItem(itemId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.rpc('send2u_delete_menu_item', { p_item_id: itemId });
  if (error) throw new Error(error.message ? `Could not delete the item: ${error.message}` : 'Could not delete the item.');
}
