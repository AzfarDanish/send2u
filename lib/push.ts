import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Expo push wrapper. Everything here degrades gracefully:
 * - Web (and any runtime without push support) reports `unsupported` — the
 *   app works fully through realtime updates + the notification center.
 * - Denied permissions report `denied` — no token, no crash, no nagging.
 * - Foreground pushes never show a system banner (non-intrusive): realtime
 *   refresh + the notification center already surface them in-app.
 * - Real delivery needs a physical device with a registered Expo push token;
 *   nothing here fakes that.
 */

export type PushRegistration =
  | { status: 'registered'; token: string }
  | { status: 'unsupported' | 'denied' | 'error' };

export type PushPlatform = 'ios' | 'android' | 'web' | 'unknown';

export function normalizePlatform(): PushPlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

let foregroundPolicySet = false;

/** Foreground pushes stay silent at OS level; the UI updates live instead. */
export function initForegroundPolicy(): void {
  if (foregroundPolicySet) return;
  foregroundPolicySet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('order-updates', {
    name: 'Order updates',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Requests permission (when needed) and returns an Expo push token, or a
 * non-registered status explaining why there is none. Never throws.
 */
export async function registerForPushToken(): Promise<PushRegistration> {
  if (Platform.OS === 'web') return { status: 'unsupported' };
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let granted = existing;
    if (existing !== 'granted') {
      const { status: asked } = await Notifications.requestPermissionsAsync();
      granted = asked;
    }
    if (granted !== 'granted') return { status: 'denied' };
    await ensureAndroidChannel();
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    const response = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    if (!response.data) return { status: 'error' };
    return { status: 'registered', token: response.data };
  } catch {
    return { status: 'unsupported' };
  }
}

/** Fires on Expo push-token refresh; caller should re-register the token. */
export function addPushTokenRefreshListener(callback: (token: string) => void): {
  remove: () => void;
} {
  const subscription = Notifications.addPushTokenListener((event) => {
    if (event.data) callback(event.data);
  });
  return { remove: () => subscription.remove() };
}

/** Fires when the user taps a notification; passes the order id, if any. */
export function addPushResponseListener(callback: (orderId: string | null) => void): {
  remove: () => void;
} {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as
      | Record<string, unknown>
      | undefined;
    callback(typeof data?.orderId === 'string' ? data.orderId : null);
  });
  return { remove: () => subscription.remove() };
}
