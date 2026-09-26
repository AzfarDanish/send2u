import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import type { HelperLocationState, LocationPermissionState } from '@/lib/maps/types';

/** The helper's own device GPS. Nothing here touches the network. */
const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  // Frequent enough to move a marker smoothly, and only while the screen is
  // open: this is the device stream, separate from what gets published.
  timeInterval: 1000,
  distanceInterval: 5,
  mayShowUserSettingsDialog: true,
};

export interface UseHelperLocationResult extends HelperLocationState {
  /** Ask the OS. Called automatically on the active delivery screen. */
  requestPermission: () => Promise<void>;
  /** For a permanently denied permission: the only fix is the settings app. */
  openSettings: () => Promise<void>;
}

function toState(
  status: Location.PermissionStatus,
  canAskAgain: boolean,
): LocationPermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'undetermined') return 'not-requested';
  return canAskAgain ? 'denied' : 'blocked';
}

/** One honest sentence per state, so no screen invents its own wording. */
export function locationStateMessage(state: LocationPermissionState): string {
  switch (state) {
    case 'not-requested':
      return 'Share your location so the requester can follow this delivery.';
    case 'denied':
      return 'Location permission was denied. Send2U cannot show the requester where you are.';
    case 'blocked':
      return 'Location permission is blocked for Send2U. Enable it in the app settings.';
    case 'services-off':
      return 'Location services are turned off on this device.';
    case 'unavailable':
      return 'Your location is temporarily unavailable.';
    case 'granted':
      return '';
    default:
      return 'Checking location permission.';
  }
}

/**
 * Watches the helper's device position while an active delivery needs it.
 *
 * Permission and services are treated as separate states because the fix
 * differs: one needs a settings change, the other needs enabling Location. The
 * watcher is a single instance guarded by a ref — re-renders and prop changes
 * must never stack a second GPS listener — and it is removed on unmount, which
 * also covers the case where the screen closes before the OS resolves the
 * subscription promise.
 *
 * The requester never mounts this hook: only the helper's device publishes.
 */
export function useHelperLocation({ enabled }: { enabled: boolean }): UseHelperLocationResult {
  const [permission, setPermission] = useState<LocationPermissionState>('unknown');
  const [coordinate, setCoordinate] = useState<HelperLocationState['coordinate']>(null);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [waitingForFix, setWaitingForFix] = useState(true);

  const subscription = useRef<Location.LocationSubscription | null>(null);
  const mounted = useRef(true);
  const autoAsked = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      subscription.current?.remove();
      subscription.current = null;
    };
  }, []);

  const stopWatch = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
  }, []);

  const startWatch = useCallback(async () => {
    if (subscription.current) return;
    try {
      const sub = await Location.watchPositionAsync(WATCH_OPTIONS, (fix) => {
        if (!mounted.current) return;
        setCoordinate({ latitude: fix.coords.latitude, longitude: fix.coords.longitude });
        setAccuracyMeters(
          Number.isFinite(fix.coords.accuracy) ? (fix.coords.accuracy as number) : null,
        );
        setUpdatedAt(Date.now());
        setWaitingForFix(false);
      });
      // The screen may have closed while the OS was starting the watcher.
      if (!mounted.current) {
        sub.remove();
        return;
      }
      subscription.current = sub;
    } catch {
      if (!mounted.current) return;
      setPermission('unavailable');
      setWaitingForFix(false);
    }
  }, []);

  const evaluate = useCallback(
    async ({ allowPrompt }: { allowPrompt: boolean }) => {
      let servicesOn = true;
      try {
        servicesOn = await Location.hasServicesEnabledAsync();
      } catch {
        servicesOn = true;
      }
      if (!mounted.current) return;
      if (!servicesOn) {
        stopWatch();
        setPermission('services-off');
        setWaitingForFix(false);
        return;
      }

      const current = await Location.getForegroundPermissionsAsync();
      if (!mounted.current) return;
      let state = toState(current.status, current.canAskAgain);

      if (state === 'not-requested' && allowPrompt && !autoAsked.current) {
        autoAsked.current = true;
        const asked = await Location.requestForegroundPermissionsAsync();
        if (!mounted.current) return;
        state = toState(asked.status, asked.canAskAgain);
      }

      setPermission(state);
      if (state === 'granted') {
        setWaitingForFix(true);
        await startWatch();
      } else {
        stopWatch();
        setWaitingForFix(false);
      }
    },
    [startWatch, stopWatch],
  );

  // Enabled: the helper is on an active delivery, so asking once is warranted.
  // Disabled: nothing to ask for, and the watcher must not keep running.
  useEffect(() => {
    if (!enabled) {
      stopWatch();
      setCoordinate(null);
      setAccuracyMeters(null);
      setUpdatedAt(null);
      setPermission('unknown');
      setWaitingForFix(true);
      autoAsked.current = false;
      return;
    }
    void evaluate({ allowPrompt: true });
  }, [enabled, evaluate, stopWatch]);

  const requestPermission = useCallback(async () => {
    const asked = await Location.requestForegroundPermissionsAsync();
    if (!mounted.current) return;
    autoAsked.current = true;
    const state = toState(asked.status, asked.canAskAgain);
    setPermission(state);
    if (state === 'granted') {
      setWaitingForFix(true);
      await startWatch();
    }
  }, [startWatch]);

  const openSettings = useCallback(async () => {
    await Linking.openSettings().catch(() => {});
  }, []);

  return {
    permission,
    coordinate,
    accuracyMeters,
    updatedAt,
    waitingForFix,
    requestPermission,
    openSettings,
  };
}
