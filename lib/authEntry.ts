/**
 * One-shot marker for "the user just completed an explicit sign-in".
 *
 * The root route is a content screen, not a bouncing gate: an app launch with
 * an already-restored session lands on it and waits for a tap. But a user who
 * has just typed their password has asked to be let in, and sign-in is the one
 * flow allowed to forward them straight into the app.
 *
 * The sign-in screen sets the flag; the root route consumes it once, so the
 * forward happens exactly once per sign-in and never on a cold start. Module
 * state (not a provider) because the two screens are unrelated in the tree and
 * the value must survive a single navigation.
 */

let pending = false;

/** Called by the sign-in screen after a successful password sign-in. */
export function markFreshAuthEntry(): void {
  pending = true;
}

/** Reads and clears the marker. Returns false when no sign-in just happened. */
export function consumeFreshAuthEntry(): boolean {
  if (!pending) return false;
  pending = false;
  return true;
}
