import { dedupeRequest } from '@/lib/dedupe';
import type { LatLng } from '@/lib/maps/types';
import { getSupabaseClient } from '@/lib/supabase';
import type { DeliveryLocation } from '@/types/domain';

/**
 * Delivery-location service layer.
 *
 * Locations stay curated data: requesters must never rename one or re-describe
 * one, so the table keeps the SELECT-only policies it always had. The drop-off
 * pin is the one thing here a person, not an administrator, can supply — a
 * coordinate only someone standing at the point actually knows — and it goes
 * through a `send2u_*` SECURITY DEFINER function rather than a table write,
 * matching every other write in this project.
 *
 * That function also owns the once-only rule: its guarded UPDATE matches no row
 * once a pin exists, so a second attempt is reported as `already set` and the
 * UI shows the existing pin read-only instead of retrying. Nothing here
 * pretends a placed pin can be edited.
 *
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

interface DeliveryLocationRow {
  id: string;
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toDeliveryLocation(row: DeliveryLocationRow): DeliveryLocation {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    lat: row.lat,
    lng: row.lng,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * A drop-off point that already has its pin. Separate from a plain failure
 * because it is not: the write was refused by design, and the screen answers it
 * by showing the existing pin instead of offering a retry that can never work.
 */
export class LocationPinAlreadySetError extends Error {
  constructor() {
    super('This drop-off point already has a pin. Only an administrator can move it.');
    this.name = 'LocationPinAlreadySetError';
  }
}

/** Active campus drop-off points, in display order. */
export async function listDeliveryLocations(): Promise<DeliveryLocation[]> {
  const supabase = requireClient();
  // In-flight deduped: review, picker, and browser can mount together.
  return dedupeRequest('send2u:delivery-locations', async () => {
    const { data, error } = await supabase
      .from('send2u_delivery_locations')
      .select('id, name, description, lat, lng, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw new Error(`Could not load delivery locations: ${error.message}`);
    return (data as DeliveryLocationRow[]).map(toDeliveryLocation);
  });
}

/**
 * Places the drop-off pin for one point, once, from the requester's own tap on
 * the map. The server decides ownership and the once-only rule; the coordinate
 * that comes back is the one the database stored, so the screen shows what was
 * really saved rather than what it hoped to save.
 */
export async function setDeliveryLocationPin(
  locationId: string,
  coordinate: LatLng,
): Promise<LatLng> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_set_delivery_location_pin', {
    p_location_id: locationId,
    p_lat: coordinate.latitude,
    p_lng: coordinate.longitude,
  });
  if (error) {
    // 23505 is the function's own "already has a pin"; another requester may
    // have pinned this point between this screen's read and this tap.
    if (error.code === '23505' || /already has a pin/i.test(error.message ?? '')) {
      throw new LocationPinAlreadySetError();
    }
    if (/not found/i.test(error.message ?? '')) {
      throw new Error('That drop-off point is no longer available.');
    }
    if (/only requester accounts/i.test(error.message ?? '')) {
      throw new Error('Only requester accounts can place a drop-off pin.');
    }
    if (/coordinates are invalid/i.test(error.message ?? '')) {
      throw new Error('That pin is not a usable coordinate. Tap the map again.');
    }
    throw new Error(
      error.message ? `Could not save the drop-off pin: ${error.message}` : 'Could not save the drop-off pin.',
    );
  }
  if (!isRecord(data) || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
    throw new Error('Saving the drop-off pin came back in an unexpected shape.');
  }
  return { latitude: data.lat, longitude: data.lng };
}
