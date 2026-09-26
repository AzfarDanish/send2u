import { dedupeRequest } from '@/lib/dedupe';
import type { LatLng } from '@/lib/maps/types';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * Live helper position transport.
 *
 * One row per order, upserted in place. The product needs where the helper is
 * now, not a GPS history, so nothing here appends: publishing overwrites the
 * order's single row, and tracking cleanup deletes it. That keeps the table
 * tiny and means there is never a trail of past positions to leak.
 *
 * All access control is server-side (see the tracking migration): a helper may
 * write only their own row for an order assigned to them, and a requester may
 * read only the row for one of their own orders. This client assumes nothing
 * beyond that — a row the caller may not see simply comes back empty, and the
 * UI says the location is unavailable instead of inventing one.
 */

const TABLE = 'send2u_delivery_positions';

export interface DeliveryPosition {
  orderId: string;
  helperId: string;
  coordinate: LatLng;
  /** Device-reported accuracy in metres, null when the fix did not include it. */
  accuracyMeters: number | null;
  /** When the helper's device wrote the fix (ISO). */
  updatedAt: string;
}

interface DeliveryPositionRow {
  order_id: string;
  helper_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  updated_at: string;
}

const COLUMNS = 'order_id, helper_id, lat, lng, accuracy_m, updated_at';

function mapRow(row: DeliveryPositionRow): DeliveryPosition {
  return {
    orderId: row.order_id,
    helperId: row.helper_id,
    coordinate: { latitude: row.lat, longitude: row.lng },
    accuracyMeters: row.accuracy_m ?? null,
    updatedAt: row.updated_at,
  };
}

/** The helper's current position for one order, or null when never published. */
export async function fetchDeliveryPosition(
  orderId: string,
): Promise<DeliveryPosition | null> {
  return dedupeRequest(`delivery-position:${orderId}`, async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .eq('order_id', orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRow(data as DeliveryPositionRow) : null;
  });
}

/**
 * Writes the helper's own position. `updated_at` is set here rather than by a
 * trigger: the device is the source of truth for the fix's age, and the UI
 * compares it against the device clock to decide "live" versus "stale".
 */
export async function publishDeliveryPosition(input: {
  orderId: string;
  helperId: string;
  coordinate: LatLng;
  accuracyMeters: number | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Not connected.');
  const { error } = await supabase.from(TABLE).upsert(
    {
      order_id: input.orderId,
      helper_id: input.helperId,
      lat: input.coordinate.latitude,
      lng: input.coordinate.longitude,
      accuracy_m: input.accuracyMeters,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' },
  );
  if (error) throw new Error(error.message);
}

/**
 * Drops the row when live tracking stops (delivered, cancelled, disputed, or
 * the helper leaving the active screen). Best-effort by design: a failed delete
 * leaves one stale row that the requester's UI already renders as stale, and
 * the next publish or terminal transition removes it.
 */
export async function clearDeliveryPosition(orderId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).delete().eq('order_id', orderId);
  if (error) throw new Error(error.message);
}

/**
 * Realtime position stream for one order, on its own channel — the same shape
 * the transaction view already uses. Returns the unsubscribe function; exactly
 * one subscription belongs to each open tracking screen.
 */
export function subscribeDeliveryPosition(
  orderId: string,
  onChange: (position: DeliveryPosition | null) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  let cancelled = false;
  const channel = supabase
    .channel(`send2u:position:${orderId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `order_id=eq.${orderId}` },
      (payload) => {
        if (cancelled) return;
        // A DELETE (or an emptied row) means tracking ended: the position is
        // gone, which the UI must show as "no longer sharing", not as stale.
        const row = (payload.new ?? null) as DeliveryPositionRow | null;
        if (payload.eventType === 'DELETE' || !row || typeof row.lat !== 'number') {
          onChange(null);
          return;
        }
        onChange(mapRow(row));
      },
    )
    .subscribe((status) => {
      if (cancelled || !onStatus) return;
      onStatus(status === 'SUBSCRIBED');
    });
  return () => {
    cancelled = true;
    void supabase.removeChannel(channel);
  };
}
