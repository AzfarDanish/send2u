import type { LatLng } from '@/lib/maps/types';

/**
 * Small geodesic helpers.
 *
 * The tracking layer needs "has the helper moved enough to matter" and "how far
 * is this fix from where we drew the route", and both answers have to be real
 * distances rather than degree arithmetic. Nothing here computes a position:
 * these are comparisons between coordinates the device or the database supplied.
 */

const EARTH_RADIUS_M = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in metres between two real fixes. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when two fixes are the same point to within `toleranceMeters`. */
export function isSamePoint(a: LatLng, b: LatLng, toleranceMeters = 1): boolean {
  return distanceMeters(a, b) <= toleranceMeters;
}

/** True when a coordinate is a usable real fix (finite and in range). */
export function isValidLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as LatLng;
  return (
    Number.isFinite(candidate.latitude) &&
    Number.isFinite(candidate.longitude) &&
    Math.abs(candidate.latitude) <= 90 &&
    Math.abs(candidate.longitude) <= 180
  );
}
