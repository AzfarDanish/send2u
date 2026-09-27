import * as Location from 'expo-location';
import { useState } from 'react';
import { Linking, Platform } from 'react-native';

import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { registerForPushToken } from '@/lib/push';
import { registerPushToken } from '@/services/pushTokens';

type PushState = 'idle' | 'working' | 'denied-retry' | 'denied-settings' | 'unsupported' | 'error';
type LocationState =
  | 'idle'
  | 'working'
  | 'denied-retry'
  | 'denied-settings'
  | 'services-off'
  | 'unsupported';

/**
 * Post-signup permissions walkthrough: notifications (1 of 2), then
 * location (2 of 2), in the auth shell so the flow visually continues
 * signup. Both screens are tap-through — granting is encouraged but never
 * a dead end: a deny offers re-ask or the OS Settings deep link plus an
 * always-available Continue, because the OS may refuse to re-prompt and
 * the app stays fully usable on realtime + in-app surfaces.
 *
 * Location is foreground/WhenInUse only, matching the shipped config and
 * the "only while…" promise — no background ask exists in this product.
 */
export function OnboardingPermissions({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  return step === 1 ? (
    <NotificationsStep onAdvance={() => setStep(2)} />
  ) : (
    <LocationStep onAdvance={onComplete} />
  );
}

function openSettings(): void {
  void Linking.openSettings().catch(() => {});
}

function NotificationsStep({ onAdvance }: { onAdvance: () => void }) {
  const [state, setState] = useState<PushState>('idle');
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const registration = await registerForPushToken();
      if (registration.status === 'registered') {
        // Best-effort: the root hook re-registers on mount anyway, and
        // realtime + the notification center cover a failed write.
        await registerPushToken(registration.token).catch(() => {});
        onAdvance();
        return;
      }
      if (registration.status === 'unsupported') setState('unsupported');
      else if (registration.status === 'denied')
        setState(registration.canAskAgain ? 'denied-retry' : 'denied-settings');
      else setState('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Stay updated"
      description="Send2U sends order status, helper, and delivery updates as notifications.">
      <Text variant="caption" color="secondary">
        Step 1 of 2
      </Text>
      {state === 'denied-retry' ? (
        <Text color="secondary">
          Notifications are off. You can turn them on now, or continue — updates still appear
          inside the app.
        </Text>
      ) : null}
      {state === 'denied-settings' ? (
        <Text color="secondary">
          Notifications are blocked at the system level, so this app can no longer ask. Turn
          them on in Settings, or continue — updates still appear inside the app.
        </Text>
      ) : null}
      {state === 'unsupported' ? (
        <Text color="secondary">
          This device cannot receive push notifications. Updates still appear inside the app.
        </Text>
      ) : null}
      {state === 'error' ? (
        <Text color="secondary">
          Something went wrong while enabling notifications. You can try again or continue.
        </Text>
      ) : null}
      {state === 'idle' || state === 'denied-retry' || state === 'error' ? (
        <Button
          title={busy ? 'Working…' : state === 'idle' ? 'Allow notifications' : 'Try again'}
          onPress={() => void allow()}
          disabled={busy}
          loading={busy}
        />
      ) : null}
      {state === 'denied-settings' ? <Button title="Open Settings" onPress={openSettings} /> : null}
      {state !== 'idle' ? (
        <Button title="Continue" variant="secondary" onPress={onAdvance} disabled={busy} />
      ) : null}
    </AuthScreen>
  );
}

function LocationStep({ onAdvance }: { onAdvance: () => void }) {
  const [state, setState] = useState<LocationState>(
    Platform.OS === 'web' ? 'unsupported' : 'idle',
  );
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let servicesOn = true;
      try {
        servicesOn = await Location.hasServicesEnabledAsync();
      } catch {
        servicesOn = true;
      }
      if (!servicesOn) {
        setState('services-off');
        return;
      }
      const current = await Location.getForegroundPermissionsAsync();
      if (current.status === 'granted') {
        onAdvance();
        return;
      }
      if (!current.canAskAgain) {
        setState('denied-settings');
        return;
      }
      const asked = await Location.requestForegroundPermissionsAsync();
      if (asked.status === 'granted') {
        onAdvance();
        return;
      }
      setState(asked.canAskAgain ? 'denied-retry' : 'denied-settings');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Show your location"
      description="Send2U uses your location only while placing a pin or following a delivery — never in the background.">
      <Text variant="caption" color="secondary">
        Step 2 of 2
      </Text>
      {state === 'denied-retry' ? (
        <Text color="secondary">
          Location is off. You can turn it on now, or continue — you can still place pins by
          hand on the map.
        </Text>
      ) : null}
      {state === 'denied-settings' ? (
        <Text color="secondary">
          Location is blocked at the system level, so this app can no longer ask. Turn it on
          in Settings, or continue — you can still place pins by hand on the map.
        </Text>
      ) : null}
      {state === 'services-off' ? (
        <Text color="secondary">
          Location services are switched off on this device. Turn them on in Settings, or
          continue — you can still place pins by hand on the map.
        </Text>
      ) : null}
      {state === 'unsupported' ? (
        <Text color="secondary">
          This device cannot share its location here. You can still place pins by hand on the
          map.
        </Text>
      ) : null}
      {state === 'idle' || state === 'denied-retry' ? (
        <Button
          title={busy ? 'Working…' : state === 'idle' ? 'Allow location' : 'Try again'}
          onPress={() => void allow()}
          disabled={busy}
          loading={busy}
        />
      ) : null}
      {state === 'denied-settings' || state === 'services-off' ? (
        <Button title="Open Settings" onPress={openSettings} />
      ) : null}
      {state !== 'idle' ? (
        <Button title="Continue" variant="secondary" onPress={onAdvance} disabled={busy} />
      ) : null}
    </AuthScreen>
  );
}
