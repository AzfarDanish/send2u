import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { LOCATE_TIMEOUT_MS } from '@/lib/maps/config';
import type { LatLng } from '@/lib/maps/types';

export type LocateOutcome =
  | 'ok'
  | 'denied'
  | 'blocked'
  | 'services-off'
  | 'unavailable';

export interface UseLocateMeResult {
  locating: boolean;
  /** Outcome of the last attempt, null before the first one. */
  outcome: LocateOutcome | null;
  coordinate: LatLng | null;
  /** Device-reported accuracy in metres, null when the fix omits it. */
  accuracyMeters: number | null;
  /** True while the shown fix is the platform's cached one, not a new reading. */
  fromCache: boolean;
  locate: () => Promise<void>;
  openSettings: () => Promise<void>;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * One-shot "where am I", for the moment a person is placing a pin on the ground
 * they are standing on.
 *
 * Deliberately not a watcher: a pin is placed once, so this asks for a single
 * fix and stops. Nothing here publishes anything, and nothing here runs until
 * the user taps the control, which is what keeps the location permission off the
 * requester's tracking screens entirely.
 *
 * A cached fix is painted first so the map moves immediately, then the fresh
 * reading replaces it and `fromCache` goes false. If the fresh reading times out
 * or fails, the cached one stays on screen and the outcome says so rather than
 * pretending a stale coordinate is a current one.
 */
export function useLocateMe(): UseLocateMeResult {
  const [locating, setLocating] = useState(false);
  const [outcome, setOutcome] = useState<LocateOutcome | null>(null);
  const [coordinate, setCoordinate] = useState<LatLng | null>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const openSettings = useCallback(async () => {
    await Linking.openSettings().catch(() => {});
  }, []);

  const locate = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLocating(true);

    const apply = (
      position: Location.LocationObject,
      cached: boolean,
    ): void => {
      if (!mounted.current) return;
      setCoordinate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setAccuracyMeters(
        Number.isFinite(position.coords.accuracy) ? (position.coords.accuracy as number) : null,
      );
      setFromCache(cached);
    };

    try {
      let servicesOn = true;
      try {
        servicesOn = await Location.hasServicesEnabledAsync();
      } catch {
        servicesOn = true;
      }
      if (!mounted.current) return;
      if (!servicesOn) {
        setOutcome('services-off');
        return;
      }

      const current = await Location.getForegroundPermissionsAsync();
      if (!mounted.current) return;
      if (current.status !== 'granted') {
        if (!current.canAskAgain) {
          setOutcome('blocked');
          return;
        }
        const asked = await Location.requestForegroundPermissionsAsync();
        if (!mounted.current) return;
        if (asked.status !== 'granted') {
          setOutcome(asked.canAskAgain ? 'denied' : 'blocked');
          return;
        }
      }

      // Paint the cached fix at once so the map jumps without waiting.
      const cached = await Location.getLastKnownPositionAsync({
        maxAge: 120_000,
        requiredAccuracy: 500,
      });
      if (cached) {
        apply(cached, true);
        setOutcome('ok');
      }

      const fresh = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        LOCATE_TIMEOUT_MS,
      );
      apply(fresh, false);
      setOutcome('ok');
    } catch {
      if (!mounted.current) return;
      // A timeout with a cached fix already drawn is not a failure: the control
      // keeps saying where the user is and simply stops upgrading it.
      setOutcome((previous) => previous ?? 'unavailable');
    } finally {
      inFlight.current = false;
      if (mounted.current) setLocating(false);
    }
  }, []);

  return {
    locating,
    outcome,
    coordinate,
    accuracyMeters,
    fromCache,
    locate,
    openSettings,
  };
}
