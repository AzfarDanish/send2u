import { getSupabaseClient } from '@/lib/supabase';
import type { DeliveryLocation } from '@/types/domain';

/**
 * Delivery-location service layer — read-only by design.
 * The database grants SELECT only; locations are curated data and
 * requesters must never modify them. Errors are thrown explicitly.
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

interface DeliveryLocationRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toDeliveryLocation(row: DeliveryLocationRow): DeliveryLocation {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Active campus drop-off points, in display order. */
export async function listDeliveryLocations(): Promise<DeliveryLocation[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_delivery_locations')
    .select('id, name, description, sort_order, created_at, updated_at')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(`Could not load delivery locations: ${error.message}`);
  return (data as DeliveryLocationRow[]).map(toDeliveryLocation);
}
