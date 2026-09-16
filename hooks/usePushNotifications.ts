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
import { getJobDetail, getOrderDetail } from '@/services/orders';

/**
 * Device push lifecycle, mounted once at the app root while signed in:
 * permission → Expo push token → server registration; token refresh
 * re-registration; notification tap → the relevant detail screen: the
 * requester detail for the user's own requests, the Helper Portal
 * workspace for deliveries assigned to a verified helper. Everything is
 * best-effort: push is an enhancement over the realtime +
 * notification-center baseline, never a requirement. Sign-out removal is
 * attempted but may already be sessionless — stale tokens are harmless
 * server-side (failed deliveries never break order operations).
 */
export function usePushNotifications(): void {
  const { user, role, isVerifiedHelper } = useAuth();
  const roleRef = useRef(role);
  roleRef.current = role;
  const userRef = useRef(user);
  userRef.current = user;
  const helperRef = useRef(isVerifiedHelper);
  helperRef.current = isVerifiedHelper;
  const currentToken = useRef<string | null>(null);

  useEffect(() => {
    initForegroundPolicy();
    const subscription = addPushResponseListener((orderId) => {
      if (!orderId) return;
      if (roleRef.current === 'vendor') {
        // Vendors receive no order notifications by design; a stale tap
        // lands on the vendor home instead of a requester screen.
        router.replace('/(vendor)');
        return;
      }
      void (async () => {
        const myUid = userRef.current?.id ?? null;
        // Own request first: verified helpers are requesters too, and
        // their own orders must keep requester context. (Ownership is
        // checked on the row — assigned helpers can also SELECT the
        // order, so visibility alone must not decide the destination.)
        try {
          const order = await getOrderDetail(orderId);
          if (order && order.requesterId === myUid) {
            router.replace({ pathname: '/(requester)/orders/[id]', params: { id: orderId } });
            return;
          }
          // Delivery assigned to this helper → portal workspace.
          if (helperRef.current && order && order.helperId === myUid) {
            router.replace({ pathname: '/(requester)/helper-portal/jobs/[id]', params: { id: orderId } });
            return;
          }
        } catch {
          // Fall through to the fallbacks below.
        }
        // Not mine as a requester delivery: re-check as a helper job
        // (queue-visible rows carry no assignment yet).
        if (helperRef.current && myUid) {
          try {
            const job = await getJobDetail(orderId);
            if (job && job.helperId === myUid) {
              router.replace({ pathname: '/(requester)/helper-portal/jobs/[id]', params: { id: orderId } });
              return;
            }
          } catch {
            // Fall through to the requester fallback below.
          }
        }
        router.replace({ pathname: '/(requester)/orders/[id]', params: { id: orderId } });
      })();
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
