import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchDeliveryPosition,
  subscribeDeliveryPosition,
  type DeliveryPosition,
} from '@/services/deliveryPositions';

/** A fix older than this is not "live", whatever the socket says. */
const STALE_AFTER_MS = 60_000;

/** How often to re-check the age of the fix so the UI stops claiming live. */
const AGE_TICK_MS = 10_000;

export type DeliveryPositionStatus =
  | 'idle'
  | 'loading'
  | 'live'
  | 'stale'
  | 'none'
  | 'error';

export interface UseDeliveryPositionResult {
  position: DeliveryPosition | null;
  status: DeliveryPositionStatus;
  error: string | null;
  /**
   * True only while the realtime socket is actually subscribed. When false the
   * screen must not present the current fix as live.
   */
  realtimeConnected: boolean;
  refresh: () => Promise<void>;
}

/**
 * Reads the helper's live position for one order.
 *
 * Used unchanged by both roles: the helper reads back what their own device
 * published (so both screens agree on one truth), the requester reads the row
 * RLS lets them see. Three things are deliberately separate here:
 *
 * 1. the one-off fetch, which gives the screen a position immediately instead
 *    of waiting for the next publish;
 * 2. the realtime stream, resubscribed per order and torn down on unmount;
 * 3. an age check on a slow timer, because a socket that is connected but
 *    silent must not keep showing an old fix as if it were live.
 */
export function useDeliveryPosition(
  orderId: string,
  { enabled = true }: { enabled?: boolean } = {},
): UseDeliveryPositionResult {
  const [position, setPosition] = useState<DeliveryPosition | null>(null);
  const [status, setStatus] = useState<DeliveryPositionStatus>(enabled ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await fetchDeliveryPosition(orderId);
      if (!mounted.current) return;
      setPosition(next);
      setStatus(next ? 'live' : 'none');
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : 'Could not load the helper position.');
      setStatus('error');
    }
  }, [orderId]);

  useEffect(() => {
    if (!enabled || !orderId) {
      setStatus('idle');
      return;
    }
    setStatus('loading');
    void load();

    const unsubscribe = subscribeDeliveryPosition(
      orderId,
      (next) => {
        if (!mounted.current) return;
        setPosition(next);
        setStatus(next ? 'live' : 'none');
        setError(null);
      },
      (connected) => {
        if (!mounted.current) return;
        setRealtimeConnected(connected);
        // Coming back from a dropout: catch up on anything missed while the
        // socket was down rather than trusting the last payload we saw.
        if (connected) void load();
      },
    );

    return () => {
      unsubscribe();
      setRealtimeConnected(false);
    };
  }, [enabled, orderId, load]);

  // Downgrade to "stale" purely on age, so a silent connection cannot pass for
  // a live one. No extra network traffic: this only compares the clock.
  useEffect(() => {
    if (!enabled || !position) return;
    const tick = () => {
      const age = Date.now() - new Date(position.updatedAt).getTime();
      if (!Number.isFinite(age)) return;
      setStatus(age > STALE_AFTER_MS ? 'stale' : 'live');
    };
    tick();
    const timer = setInterval(tick, AGE_TICK_MS);
    return () => clearInterval(timer);
  }, [enabled, position]);

  return { position, status, error, realtimeConnected, refresh: load };
}
