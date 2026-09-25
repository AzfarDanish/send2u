/**
 * Send2U motion tokens — Apple fluid-interface values translated to
 * Reanimated (Expo SDK 57, Reanimated 4.5.1).
 *
 * Apple frames motion as damping ratio + response (seconds), not duration.
 * Reanimated `withSpring` takes stiffness/damping/mass; the pairs below
 * approximate Apple's shipped values:
 * - default: critically damped, no overshoot (damping ratio 1.0,
 *   response ~0.35s) — every press, card, dock, and sheet.
 * - flick: slightly under-damped (damping ratio ~0.8, response ~0.35s) —
 *   only when a gesture carried momentum (fling-to-complete, thrown sheet).
 */

export const springDefault = {
  damping: 28,
  stiffness: 320,
  mass: 1,
} as const;

export const springFlick = {
  damping: 18,
  stiffness: 280,
  mass: 1,
} as const;

/** Instant press-down scale (Apple §1: feedback on pointer-down, 100ms). */
export const pressScale = 0.97 as const;
export const pressDurationMs = 100 as const;

/** Opacity cross-fade used ONLY as the reduced-motion fallback. */
export const fadeDurationMs = 200 as const;

/**
 * Apple's exact momentum-projection function (Designing Fluid Interfaces
 * sample code): exponential decay, NOT the physics-textbook v²/(2·decel).
 * Returns extra pixels the gesture would travel before stopping.
 *
 * @param initialVelocity px/s at release
 * @param decelerationRate 0.998 = normal scroll feel, 0.99 = snappier
 */
export function project(initialVelocity: number, decelerationRate = 0.998): number {
  return ((initialVelocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Progressive boundary resistance (Apple §9: rubber-band, don't hard-stop).
 * The further past the bound, the less the element follows.
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (overshoot === 0) return 0;
  return ((overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot)));
}
