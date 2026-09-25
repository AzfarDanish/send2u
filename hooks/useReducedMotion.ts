import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Reactive reduced-motion flag (Apple §14).
 * - `true` → replace slides/springs/parallax with short opacity
 *   cross-fades or instant transitions; drop overshoot.
 * - Opacity/color comprehension feedback is kept.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (!cancelled) setReduced(enabled);
      } catch {
        // Best-effort: keep motion on when the OS query fails.
      }
    })();
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled: boolean) => {
      setReduced(enabled);
    });
    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
}
