import { getSupabaseClient } from '@/lib/supabase';
import type { MenuItemWithVendor, Vendor, VendorMenuSection } from '@/types/domain';

/**
 * Menu service layer — read-only by design.
 * The database grants SELECT only, and there are intentionally no write
 * functions here: requesters must never modify vendor/menu data.
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

type MenuItemJoinRow = MenuItemRow & {
  vendor: Pick<VendorRow, 'id' | 'name' | 'description' | 'location_hint' | 'operating_hours' | 'is_open'>;
};

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

function toMenuItem(row: MenuItemJoinRow): MenuItemWithVendor;
function toMenuItem(row: MenuItemRow): Omit<MenuItemWithVendor, 'vendor'>;
function toMenuItem(row: MenuItemRow | MenuItemJoinRow): Omit<MenuItemWithVendor, 'vendor'> & {
  vendor?: MenuItemWithVendor['vendor'];
} {
  const base = {
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
  if ('vendor' in row && row.vendor) {
    return {
      ...base,
      vendor: {
        id: row.vendor.id,
        name: row.vendor.name,
        description: row.vendor.description,
        locationHint: row.vendor.location_hint,
        operatingHours: row.vendor.operating_hours,
        isOpen: row.vendor.is_open,
      },
    };
  }
  return base;
}

function toMenuError(error: { message: string }, fallback: string): Error {
  return new Error(error.message ? `${fallback}: ${error.message}` : fallback);
}

/** Active vendors, in display order. */
export async function listVendors(): Promise<Vendor[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_vendors')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw toMenuError(error, 'Could not load vendors');
  return (data as VendorRow[]).map(toVendor);
}

/** Full requester menu: active vendors with their items, in display order. */
export async function listVendorSections(): Promise<VendorMenuSection[]> {
  const supabase = requireClient();
  // Independent queries — one roundtrip instead of two serial ones.
  const [vendorRes, itemRes] = await Promise.all([
    supabase
      .from('send2u_vendors')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('send2u_menu_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ]);
  if (vendorRes.error) throw toMenuError(vendorRes.error, 'Could not load vendors');
  if (itemRes.error) throw toMenuError(itemRes.error, 'Could not load menu items');

  const vendorRows = vendorRes.data;
  const itemRows = itemRes.data;

  const vendors = (vendorRows as VendorRow[]).map(toVendor);
  const itemsByVendor = new Map<string, MenuItemWithVendor[]>();
  for (const row of itemRows as MenuItemRow[]) {
    const vendor = vendors.find((v) => v.id === row.vendor_id);
    if (!vendor) continue;
    const item: MenuItemWithVendor = {
      ...(toMenuItem(row) as Omit<MenuItemWithVendor, 'vendor'>),
      vendor: {
        id: vendor.id,
        name: vendor.name,
        description: vendor.description,
        locationHint: vendor.locationHint,
        operatingHours: vendor.operatingHours,
        isOpen: vendor.isOpen,
      },
    };
    const list = itemsByVendor.get(vendor.id) ?? [];
    list.push(item);
    itemsByVendor.set(vendor.id, list);
  }
  return vendors.map((vendor) => ({ vendor, items: itemsByVendor.get(vendor.id) ?? [] }));
}

/** Single item with its vendor. Returns null when not visible to the caller. */
export async function getMenuItem(id: string): Promise<MenuItemWithVendor | null> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_menu_items')
    .select('*, vendor:send2u_vendors(id, name, description, location_hint, operating_hours, is_open)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw toMenuError(error, 'Could not load menu item');
  if (!data) return null;
  return toMenuItem(data as unknown as MenuItemJoinRow);
}
