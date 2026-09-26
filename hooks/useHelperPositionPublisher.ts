import { useEffect, useRef, useState } from 'react';

import { distanceMeters, isValidLatLng } from '@/lib/maps/geo';
import type { LatLng } from '@/lib/maps/types';
import { clearDeliveryPosition, publishDeliveryPosition } from '@/services/deliveryPositions';

/** At most one publish every this many milliseconds. */
const PUBLISH_MIN_INTERVAL_MS = 5_000;
/** …or immediately once the helper has moved this far, whichever comes first. */
const PUBLISH_MIN_DISTANCE_M = 20;

export interface UseHelperPositionPublisherOptions {
  orderId: string;
  helperId: string;
  /** Latest device fix; null until one arrives. */
  coordinate: LatLng | null;
  accuracyMeters: number | null;
  /** True while this delivery is in a phase that requires live tracking. */
  enabled: boolean;
  /**
   * True once the order is terminal. Deleting the position is the cleanup step:
   * a finished or cancelled delivery must leave nothing to track.
   */
  terminal?: boolean;
}

export interface UseHelperPositionPublisherResult {
  /** Last successful publish time, for the helper's own "sharing" indicator. */
  lastPublishedAt: number | null;
  /** Set when a publish fails; the next movement retries on its own. */
  publishError: string | null;
}

/**
 * Publishes the helper's position to the backend while the delivery is live.
 *
 * Deliberately rate-limited away from the GPS stream: the device fixes arrive
 * about once a second, the backend sees a write only every five seconds or
 * twenty metres. That keeps the requester's map current without turning a
 * delivery into hundreds of writes, and it is why this is a separate concern
 * from watching the position at all.
 *
 * Cleanup follows the lifecycle rather than the screen: leaving this screen with
 * the delivery still active stops the writes but keeps the last known position
 * (it ages into "stale" on the requester's map), while a terminal order deletes
 * the row outright.
 */
export function useHelperPositionPublisher({
  orderId,
  helperId,
  coordinate,
  accuracyMeters,
  enabled,
  terminal = false,
}: UseHelperPositionPublisherOptions): UseHelperPositionPublisherResult {
  const [lastPublishedAt, setLastPublishedAt] = useState<number | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const last = useRef<{ at: number; point: LatLng | null }>({ at: 0, point: null });
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const cleared = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !coordinate || !isValidLatLng(coordinate)) return;

    const now = Date.now();
    const previous = last.current;
    const moved = previous.point ? distanceMeters(previous.point, coordinate) : Infinity;
    const due =
      previous.at === 0 ||
      now - previous.at >= PUBLISH_MIN_INTERVAL_MS ||
      moved >= PUBLISH_MIN_DISTANCE_M;
    // One write in flight at a time: an overloaded network must not queue a
    // backlog of stale fixes.
    if (!due || inFlight.current) return;

    inFlight.current = true;
    last.current = { at: now, point: { ...coordinate } };
    publishDeliveryPosition({ orderId, helperId, coordinate, accuracyMeters })
      .then(() => {
        if (!mounted.current) return;
        setLastPublishedAt(now);
        setPublishError(null);
        cleared.current = false;
      })
      .catch((error: unknown) => {
        if (!mounted.current) return;
        setPublishError(
          error instanceof Error ? error.message : 'Could not share your location.',
        );
        // Let the next fix try again rather than retrying in a tight loop.
        last.current = { at: 0, point: null };
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [accuracyMeters, coordinate, enabled, helperId, orderId]);

  // Terminal orders stop being tracked: delete the row once.
  useEffect(() => {
    if (!terminal || cleared.current) return;
    cleared.current = true;
    last.current = { at: 0, point: null };
    setLastPublishedAt(null);
    void clearDeliveryPosition(orderId).catch(() => {
      // Best effort: a leftover row still ages into "stale" on the other side,
      // and the next terminal transition clears it.
    });
  }, [orderId, terminal]);

  return { lastPublishedAt, publishError };
}
