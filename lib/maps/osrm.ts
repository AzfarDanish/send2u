import { OSRM_BASE_URL } from '@/lib/maps/config';
import { RouteError, type LatLng, type RouteResult } from '@/lib/maps/types';

/**
 * OSRM route lookup.
 *
 * One request produces one route with real geometry, distance and duration.
 * Nothing here decides *when* to ask: the caller owns the recalculation policy,
 * because only the caller knows whether the destination or phase changed. This
 * module refuses to be a polling loop.
 *
 * `overview=full` + `geometries=geojson` gives the complete road-following
 * shape as `[lng, lat]` pairs, which is exactly what the map draws. Steps and
 * annotations are off: we need the line, not turn-by-turn text.
 */

interface OsrmRoute {
  geometry?: { coordinates?: [number, number][] };
  distance?: number;
  duration?: number;
}

interface OsrmResponse {
  code?: string;
  message?: string;
  routes?: OsrmRoute[];
}

/** OSRM's driving profile: helpers move by motorbike or on foot, never by car. */
const PROFILE = 'driving';

/** Routing must never hang the UI on a slow provider. */
const TIMEOUT_MS = 12000;

export interface FetchRouteOptions {
  /** Abort a stale request when the destination changes mid-flight. */
  signal?: AbortSignal;
}

export async function fetchRoute(
  from: LatLng,
  to: LatLng,
  { signal }: FetchRouteOptions = {},
): Promise<RouteResult> {
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url =
    `${OSRM_BASE_URL}/route/v1/${PROFILE}/${coords}` +
    '?overview=full&geometries=geojson&steps=false&annotations=false';

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const abort = () => timeout.abort();
  signal?.addEventListener('abort', abort);

  let payload: OsrmResponse;
  try {
    const response = await fetch(url, { signal: timeout.signal });
    if (!response.ok) {
      throw new RouteError(
        'provider-unavailable',
        `Routing provider responded ${response.status}`,
      );
    }
    payload = (await response.json()) as OsrmResponse;
  } catch (error) {
    if (error instanceof RouteError) throw error;
    throw new RouteError('network', 'Could not reach the routing service.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }

  const route = payload.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (payload.code === 'NoRoute' || !coordinates || coordinates.length === 0) {
    throw new RouteError('no-route', 'No route found between these points.');
  }

  return {
    coordinates,
    distanceMeters: route?.distance ?? 0,
    durationSeconds: route?.duration ?? 0,
    receivedAt: Date.now(),
  };
}

/** Human distance for the tracking UI; metres under a kilometre. */
export function formatRouteDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Driving duration as a coarse arrival estimate.
 *
 * Deliberately rounded to the minute and labelled as an estimate by the caller:
 * OSRM's duration is free-flowing-traffic math, and the helper is on foot or a
 * motorbike, so a to-the-second number would claim precision we do not have.
 */
export function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
