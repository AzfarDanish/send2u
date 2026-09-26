import { getSupabaseClient } from '@/lib/supabase';
import type { SavedDeliveryLocation, SavedLocationType } from '@/types/domain';

/**
 * Saved-location service layer (the requester's personal address book).
 *
 * The shared campus points in `services/locations.ts` stay curated read-only
 * data. Everything here is per-user: rows are owned by their creator, reads
 * go through the owner SELECT policy, and every write goes through a
 * `send2u_*` SECURITY DEFINER function — matching every other write in this
 * project. The single-select rule lives in the database (partial unique index
 * plus the setter function), never in client code.
 *
 * Errors are thrown explicitly; nothing is swallowed.
 */

const LOCATION_TYPES: readonly SavedLocationType[] = [
  'home',
  'library',
  'class',
  'hostel',
  'cafeteria',
  'office',
  'other',
];

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

interface SavedLocationRow {
  id: string;
  label: string;
  sub_details: string | null;
  location_type: string;
  is_selected: boolean;
  lat: number | null;
  lng: number | null;
  building: string | null;
  block: string | null;
  floor_level: string | null;
  room_unit: string | null;
  instructions: string | null;
  custom_label: string | null;
  created_at: string;
  updated_at: string;
}

function toSavedDeliveryLocation(row: SavedLocationRow): SavedDeliveryLocation {
  const locationType: SavedLocationType = (LOCATION_TYPES as readonly string[]).includes(
    row.location_type,
  )
    ? (row.location_type as SavedLocationType)
    : 'other';
  return {
    id: row.id,
    label: row.label,
    subDetails: row.sub_details,
    locationType,
    isSelected: row.is_selected,
    lat: row.lat,
    lng: row.lng,
    building: row.building ?? null,
    block: row.block ?? null,
    floorLevel: row.floor_level ?? null,
    roomUnit: row.room_unit ?? null,
    instructions: row.instructions ?? null,
    customLabel: row.custom_label ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface SavedLocationInput {
  label: string;
  subDetails?: string | null;
  locationType?: SavedLocationType;
  lat?: number | null;
  lng?: number | null;
  building?: string | null;
  block?: string | null;
  floorLevel?: string | null;
  roomUnit?: string | null;
  instructions?: string | null;
  customLabel?: string | null;
}

function toRpcArgs(input: SavedLocationInput) {
  return {
    p_label: input.label,
    p_sub_details: input.subDetails ?? null,
    p_location_type: input.locationType ?? 'other',
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
    p_building: input.building ?? null,
    p_block: input.block ?? null,
    p_floor_level: input.floorLevel ?? null,
    p_room_unit: input.roomUnit ?? null,
    p_instructions: input.instructions ?? null,
    p_custom_label: input.customLabel ?? null,
  };
}

function describeError(action: string, message: string | undefined): Error {
  if (/sign-in is required/i.test(message ?? '')) {
    return new Error('Sign in to manage your saved locations.');
  }
  if (/not found/i.test(message ?? '')) {
    return new Error('That saved location is no longer available.');
  }
  if (/label of 1-120/i.test(message ?? '')) {
    return new Error('Give the location a label of 1-120 characters.');
  }
  if (/240 characters/i.test(message ?? '')) {
    return new Error('Location details must be 240 characters or fewer.');
  }
  if (/unknown location type/i.test(message ?? '')) {
    return new Error('That location type is not supported.');
  }
  if (/custom name is required/i.test(message ?? '')) {
    return new Error('Name this location.');
  }
  if (/500 characters/i.test(message ?? '')) {
    return new Error('Keep delivery instructions under 500 characters.');
  }
  if (/120 characters/i.test(message ?? '')) {
    return new Error('Keep location fields under 120 characters.');
  }
  if (/coordinates are invalid/i.test(message ?? '')) {
    return new Error('That pin is not a usable coordinate.');
  }
  return new Error(message ? `Could not ${action}: ${message}` : `Could not ${action}.`);
}

/** The caller's saved locations, active first, then oldest first. */
export async function listSavedDeliveryLocations(): Promise<SavedDeliveryLocation[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_saved_delivery_locations')
    .select('id, label, sub_details, location_type, is_selected, lat, lng, building, block, floor_level, room_unit, instructions, custom_label, created_at, updated_at')
    .order('is_selected', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Could not load saved locations: ${error.message}`);
  return (data as SavedLocationRow[]).map(toSavedDeliveryLocation);
}

/** Creates one saved location. The first one becomes the active location. */
export async function createSavedDeliveryLocation(
  input: SavedLocationInput,
): Promise<SavedDeliveryLocation> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('send2u_create_saved_location', toRpcArgs(input));
  if (error) throw describeError('save the location', error.message);
  const created = await fetchSavedLocationById(supabase, String((data as { id: string }).id));
  if (!created) throw new Error('Could not save the location.');
  return created;
}

/** Edits one owned location. Selection never changes here. */
export async function updateSavedDeliveryLocation(
  id: string,
  input: SavedLocationInput,
): Promise<SavedDeliveryLocation> {
  const supabase = requireClient();
  const { error } = await supabase.rpc('send2u_update_saved_location', { p_id: id, ...toRpcArgs(input) });
  if (error) throw describeError('update the location', error.message);
  const updated = await fetchSavedLocationById(supabase, id);
  if (!updated) throw new Error('Could not update the location.');
  return updated;
}

/** Deletes one owned location, promoting the oldest survivor when needed. */
export async function deleteSavedDeliveryLocation(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.rpc('send2u_delete_saved_location', { p_id: id });
  if (error) throw describeError('delete the location', error.message);
}

/** Switches the single-select active location. */
export async function setActiveSavedDeliveryLocation(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.rpc('send2u_set_active_saved_location', { p_id: id });
  if (error) throw describeError('select the location', error.message);
}

async function fetchSavedLocationById(
  supabase: ReturnType<typeof requireClient>,
  id: string,
): Promise<SavedDeliveryLocation | null> {
  const { data, error } = await supabase
    .from('send2u_saved_delivery_locations')
    .select('id, label, sub_details, location_type, is_selected, lat, lng, building, block, floor_level, room_unit, instructions, custom_label, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return toSavedDeliveryLocation(data as SavedLocationRow);
}
