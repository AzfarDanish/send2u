import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/hooks/useAuth';
import {
  addPushResponseListener,
  addPushTokenRefreshListener,
  initForegroundPolicy,
  normalizePlatform,
  registerForPushToken,
} from '@/lib/push';
import { registerPushToken, removePushToken } from '@/services/pushTokens';

/**
 * Device push lifecycle, mounted once at the app root while signed in:
 * permission → Expo push token → server registration; token refresh
 * re-registration; notification tap → the relevant order detail for the
 * current role. Everything is best-effort: push is an enhancement over the
 * realtime + notification-center baseline, never a requirement. Sign-out
 * removal is attempted but may already be sessionless — stale tokens are
 * harmless server-side (failed deliveries never break order operations).
 */
export function usePushNotifications(): void {
  const { user, role } = useAuth();
  const roleRef = useRef(role);
  roleRef.current = role;
  const currentToken = useRef<string | null>(null);

  useEffect(() => {
    initForegroundPolicy();
    const subscription = addPushResponseListener((orderId) => {
      if (!orderId) return;
      if (roleRef.current === 'helper') {
        router.replace({ pathname: '/(helper)/jobs/[id]', params: { id: orderId } });
      } else if (roleRef.current === 'vendor') {
        // Vendors receive no order notifications by design; a stale tap
        // lands on the vendor home instead of a requester screen.
        router.replace('/(vendor)');
      } else {
        router.replace({ pathname: '/(requester)/orders/[id]', params: { id: orderId } });
      }
    });
    return () => subscription.remove();
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const registration = await registerForPushToken();
      if (cancelled || registration.status !== 'registered') return;
      currentToken.current = registration.token;
      try {
        await registerPushToken(registration.token, normalizePlatform());
      } catch {
        // Registration failed (offline?). Realtime + center still work;
        // next mount retries. Never block the session on push.
      }
    })();
    const refresh = addPushTokenRefreshListener((token) => {
      currentToken.current = token;
      void registerPushToken(token, normalizePlatform()).catch(() => {});
    });
    return () => {
      cancelled = true;
      refresh.remove();
    };
  }, [userId]);

  const signedOut = !user;
  useEffect(() => {
    if (signedOut && currentToken.current) {
      const stale = currentToken.current;
      currentToken.current = null;
      void removePushToken(stale).catch(() => {});
    }
  }, [signedOut]);
}
