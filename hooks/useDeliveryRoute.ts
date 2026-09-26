import { useCallback, useEffect, useRef, useState } from 'react';

import { distanceMeters, isValidLatLng } from '@/lib/maps/geo';
import { fetchRoute } from '@/lib/maps/osrm';
import {
  RouteError,
  type LatLng,
  type RouteFailureReason,
  type RouteResult,
} from '@/lib/maps/types';

/** How far the helper must drift from the drawn route before we redraw. */
const OFF_ROUTE_METERS = 250;
/** Smallest movement that can justify refreshing an ageing route. */
const MIN_MOVE_METERS = 60;
/** A route older than this is worth refreshing, but only if the helper moved. */
const ROUTE_MAX_AGE_MS = 180_000;
/** Floor between two requests, whatever else changes. */
const MIN_INTERVAL_MS = 20_000;
/** A user-initiated retry still gets a short floor so it cannot be spammed. */
const RETRY_FLOOR_MS = 3_000;

export type RouteStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseDeliveryRouteOptions {
  /** Where the route starts: the helper's live fix, or null when unknown. */
  from: LatLng | null;
  /** Where it ends: the vendor before pickup, the drop-off after. */
  to: LatLng | null;
  /**
   * Identity of the destination and phase. A change here is an explicit "this
   * is a different journey now" and forces one recalculation.
   */
  destinationKey: string;
  enabled?: boolean;
}

export interface UseDeliveryRouteResult {
  route: RouteResult | null;
  status: RouteStatus;
  /** Why the last attempt failed, for an honest error state. */
  reason: RouteFailureReason | null;
  error: string | null;
  /** Manual retry for the error state's action. */
  retry: () => void;
}

/**
 * Keeps one route for the active delivery phase.
 *
 * The whole point of this hook is what it refuses to do: it never routes on a
 * GPS tick. Requests happen only when the destination or phase changes, when
 * the helper has drifted far enough that the drawn line no longer describes
 * their journey, or when an ageing route is refreshed after real movement —
 * and never twice within `MIN_INTERVAL_MS`.
 *
 * A failed request keeps the last good route on screen and reports the reason,
 * so a temporary provider outage leaves a usable map rather than a blank one.
 */
export function useDeliveryRoute({
  from,
  to,
  destinationKey,
  enabled = true,
}: UseDeliveryRouteOptions): UseDeliveryRouteResult {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [status, setStatus] = useState<RouteStatus>('idle');
  const [reason, setReason] = useState<RouteFailureReason | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastRequest = useRef<{ at: number; key: string; origin: LatLng | null }>({
    at: 0,
    key: '',
    origin: null,
  });
  const inFlight = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, []);

  const request = useCallback(
    async (force: boolean) => {
      if (!from || !to || !isValidLatLng(from) || !isValidLatLng(to)) return;
      const now = Date.now();
      const floor = force ? RETRY_FLOOR_MS : MIN_INTERVAL_MS;
      if (!force && now - lastRequest.current.at < floor) return;
      if (force && now - lastRequest.current.at < RETRY_FLOOR_MS) return;

      lastRequest.current = { at: now, key: destinationKey, origin: { ...from } };
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      setStatus((current) => (current === 'ready' ? current : 'loading'));
      try {
        const next = await fetchRoute(from, to, { signal: controller.signal });
        if (!mounted.current || controller.signal.aborted) return;
        setRoute(next);
        setStatus('ready');
        setReason(null);
        setError(null);
      } catch (err) {
        if (!mounted.current || controller.signal.aborted) return;
        const failureReason = err instanceof RouteError ? err.reason : 'network';
        setReason(failureReason);
        setError(err instanceof Error ? err.message : 'Could not load the route.');
        // The previous route stays on screen; only its status changes.
        setStatus('error');
      }
    },
    [destinationKey, from, to],
  );

  // Decision point, driven by real inputs rather than a timer. `from` changing
  // on every GPS fix is exactly why the checks below are distance-based.
  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      setRoute(null);
      setReason(null);
      setError(null);
      lastRequest.current = { at: 0, key: '', origin: null };
      return;
    }
    if (!from || !to) {
      // One of the two ends is unknown: no honest route exists yet.
      setRoute(null);
      setStatus('idle');
      return;
    }

    const state = lastRequest.current;
    const noRouteYet = state.key === '' || state.at === 0;
    const destinationChanged = state.key !== destinationKey;
    if (noRouteYet || destinationChanged) {
      void request(false);
      return;
    }
    if (!state.origin) {
      void request(false);
      return;
    }

    const moved = distanceMeters(state.origin, from);
    const routeAge = Date.now() - (route?.receivedAt ?? 0);
    const driftedOffRoute = moved >= OFF_ROUTE_METERS;
    const ageingAndMoved = routeAge >= ROUTE_MAX_AGE_MS && moved >= MIN_MOVE_METERS;
    if (driftedOffRoute || ageingAndMoved) void request(false);
  }, [enabled, from, to, destinationKey, route, request]);

  const retry = useCallback(() => {
    void request(true);
  }, [request]);

  return { route, status, reason, error, retry };
}
