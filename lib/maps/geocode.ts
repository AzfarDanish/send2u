import * as Location from 'expo-location';

import type { LatLng } from '@/lib/maps/types';

/**
 * Platform reverse-geocode for a map point.
 *
 * This is the "reverse-resolve coordinates to a location reference" path: it
 * uses the OS's own geocoder (`expo-location`, already installed), so no new
 * endpoint, key, or dependency is involved. It answers with a place suggestion
 * the user can accept into the Building field — never an auto-filled fact.
 *
 * Honest limits, stated plainly: the OS geocoder needs no map permission on
 * iOS but does on Android, and it is unsupported on web. Any failure —
 * denied permission, no result, no network, unsupported platform — resolves
 * to `null`, and the caller falls back to bare coordinates. Nothing here ever
 * invents a name.
 */
export interface ReverseGeocodeResult {
  /** Best single-line place reference (venue name, else street, else district). */
  placeName: string;
  /** Remaining address parts for a second line, if any. */
  detail: string | null;
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function reverseGeocodePoint(point: LatLng): Promise<ReverseGeocodeResult | null> {
  try {
    const [first] = await Location.reverseGeocodeAsync({
      latitude: point.latitude,
      longitude: point.longitude,
    });
    if (!first) return null;
    const placeName =
      clean(first.name) ?? clean(first.street) ?? clean(first.district) ?? clean(first.city);
    if (!placeName) return null;
    const rest = [
      clean(first.street) === placeName ? null : clean(first.street),
      clean(first.district),
      clean(first.city),
      clean(first.region),
    ].filter((part): part is string => part !== null);
    return {
      placeName,
      detail: rest.length > 0 ? rest.join(', ') : null,
    };
  } catch {
    return null;
  }
}
