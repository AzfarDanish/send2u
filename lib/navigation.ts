import { router, type Href } from 'expo-router';

/**
 * Go back when there is somewhere to go back to, otherwise land on the screen
 * that owns the current one.
 *
 * expo-router queues imperative actions and flushes the queue from a passive
 * effect, so a bare `router.back()` on a screen that became the app's first
 * route — a deep link, a notification tap, a dev reload straight into a route —
 * is dispatched to the root navigator with nothing to pop. That logs
 * "The action 'GO_BACK' was not handled by any navigator" and leaves the control
 * doing nothing at all. A back affordance must therefore always name a
 * destination, even if it never needs to be used in the common flow.
 */
export function goBackOr(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
