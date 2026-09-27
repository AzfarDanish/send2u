import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { pressDurationMs, project, rubberband, springDefault, springFlick } from '@/constants/motion';
import { colors, radii, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const TRACK_HEIGHT = 56;
const THUMB_SIZE = 48;
const TRACK_PADDING = 4;
const COMPLETE_FRACTION = 0.7;
/** A fast fling toward the end commits even before the 70% mark. */
const FLING_VELOCITY = 800;

interface SlideToConfirmProps {
  /** Idle label, e.g. "Slide to accept". */
  label: string;
  /** Label shown while the action runs. */
  busyLabel?: string;
  /** Label shown when disabled, e.g. a capacity explanation. */
  disabledLabel?: string;
  /**
   * Visual weight. `default` is a quiet grey track with a red thumb;
   * `filled` is a full red track with a white thumb for the single
   * consequential commitment on a decision screen; `soft` is a tinted
   * track with a red thumb for in-flow confirmations.
   */
  tone?: 'default' | 'filled' | 'soft';
  disabled?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}

function tick(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Best-effort.
  }
}

function succeed(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Best-effort.
  }
}

/**
 * Consequential confirmation control: the caller drags the thumb past
 * ~70% of the track (or flings toward it) to confirm. Apple fluid rules:
 * 1:1 tracking with grab continuity, interruptible springs from the live
 * value, release-velocity handoff, momentum projection to pick the
 * landing point, rubber-band past the end, progress-linked track fill.
 * Releasing early springs back with nothing committed. Screen-reader
 * users get an equivalent tap action.
 */
export function SlideToConfirm({
  label,
  busyLabel = 'Working…',
  disabledLabel,
  tone = 'default',
  disabled = false,
  busy = false,
  onConfirm,
}: SlideToConfirmProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const reduced = useReducedMotion();
  const locked = disabled || busy;
  const maxDx = Math.max(trackWidth - THUMB_SIZE - TRACK_PADDING * 2, 1);

  const x = useSharedValue(0);
  const crossed = useSharedValue(false);
  const confirmed = useSharedValue(false);

  // The gesture must survive parent re-renders mid-drag (realtime ticks,
  // badge counts): it is memoized on its true inputs only, and the confirm
  // callback rides a ref so a fresh parent closure never recreates it. A
  // recreated gesture cancels the active drag without `onEnd`, which is
  // exactly the "thumb reaches the end, nothing happens" failure.
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  });

  const fireConfirm = useCallback(() => {
    succeed();
    onConfirmRef.current();
    // Reset for the next use after the caller clears `busy`.
    // Reanimated shared-value writes — intended API.
    // eslint-disable-next-line react-hooks/immutability
    x.value = withSpring(0, { ...springDefault });
    // eslint-disable-next-line react-hooks/immutability
    confirmed.value = false;
  }, [confirmed, x]);

  // Identity is the bug fix here, so the dependency list is intentionally
  // minimal AND stable: `locked`/`maxDx`/`reduced` change only when behavior
  // must change, `fireConfirm` is stable, and `x`/`crossed`/`confirmed` never
  // change identity — including them would be harmless but the writes below
  // would then trip `immutability`, so they stay out on purpose.
  // The `refs` rule is a false positive inside this block: gesture worklets
  // never run during render (UI thread, deferred), which the compiler cannot
  // see — reads and writes of shared values here are Reanimated's intended
  // API, same as the per-line disables already in this file.
  /* eslint-disable react-hooks/refs, react-hooks/exhaustive-deps */
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!locked)
        .activeOffsetX([-8, 8])
        .failOffsetY([-12, 12])
        .onStart(() => {
          // Reanimated worklet writes — intended API.
          crossed.value = false;
          // eslint-disable-next-line react-hooks/immutability
          confirmed.value = false;
        })
        .onUpdate((event) => {
          const raw = event.translationX;
          if (raw <= maxDx) {
            // eslint-disable-next-line react-hooks/immutability
            x.value = Math.max(raw, 0);
          } else {
            // Rubber-band past the end instead of a hard stop (Apple §9).
            x.value = maxDx + rubberband(raw - maxDx, maxDx);
          }
          const past = x.value >= maxDx * COMPLETE_FRACTION;
          if (past && !crossed.value) {
            crossed.value = true;
            runOnJS(tick)();
          } else if (!past && crossed.value) {
            crossed.value = false;
          }
        })
        .onEnd((event) => {
          if (confirmed.value) return;
          const velocity = event.velocityX ?? 0;
          // Momentum projection (Apple §6): land where the gesture is going,
          // then commit when the projected point clears the threshold — a
          // fling commits early, a slow drag must travel the distance.
          const projected = x.value + project(velocity);
          const fling = velocity > FLING_VELOCITY && x.value > maxDx * 0.3;
          const commit =
            x.value >= maxDx * COMPLETE_FRACTION ||
            projected >= maxDx * COMPLETE_FRACTION ||
            fling;
          if (commit) {
            // eslint-disable-next-line react-hooks/immutability
            confirmed.value = true;
            // eslint-disable-next-line react-hooks/immutability
            x.value = reduced
              ? withTiming(maxDx, { duration: pressDurationMs }, (finished) => {
                  if (finished) runOnJS(fireConfirm)();
                })
              : withSpring(maxDx, { ...springFlick, velocity }, (finished) => {
                  if (finished) runOnJS(fireConfirm)();
                });
          } else {
            // Velocity handoff (Apple §5): continue at the finger's exact
            // velocity so there is no seam between drag and spring.
            x.value = reduced
              ? withTiming(0, { duration: pressDurationMs })
              : withSpring(0, { ...springDefault, velocity });
          }
        }),
    [locked, maxDx, reduced, fireConfirm],
  );
  /* eslint-enable react-hooks/refs, react-hooks/exhaustive-deps */

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: TRACK_PADDING + x.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: TRACK_PADDING * 2 + THUMB_SIZE + x.value,
    opacity: interpolate(x.value, [0, maxDx], [0, 0.35]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, maxDx * 0.6], [1, 0.25]),
  }));

  const shownLabel = busy ? busyLabel : disabled && disabledLabel ? disabledLabel : label;
  const filled = tone === 'filled';
  const soft = tone === 'soft';
  const idle = !disabled && !busy;

  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={shownLabel}
      accessibilityState={{ disabled: locked, busy }}
      accessibilityHint="Slide the handle right to confirm"
      onAccessibilityTap={() => {
        if (!locked) onConfirm();
      }}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={[styles.track, filled && styles.trackFilled, soft && styles.trackSoft, (disabled || busy) && styles.trackDisabled]}>
      <Animated.View
        style={[styles.fill, filled && styles.fillFilled, fillStyle]}
        pointerEvents="none"
      />
      <Animated.View style={labelStyle} pointerEvents="none">
        <Text
          variant="secondary"
          style={[
            styles.label,
            filled && styles.labelFilled,
            soft && styles.labelSoft,
            disabled && !busy && styles.labelDisabled,
          ]}
          numberOfLines={1}>
          {shownLabel}
        </Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.thumb,
            filled && styles.thumbFilled,
            thumbStyle,
            disabled && !busy && styles.thumbDisabled,
          ]}>
          {busy ? (
            <ActivityIndicator color={filled || idle ? colors.onPrimary : colors.primary} />
          ) : (
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={filled && idle ? colors.primary : colors.onPrimary}
            />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  trackDisabled: {
    backgroundColor: colors.disabledBackground,
  },
  trackFilled: {
    backgroundColor: colors.primary,
  },
  trackSoft: {
    backgroundColor: colors.primarySoft,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  fillFilled: {
    backgroundColor: colors.onPrimary,
  },
  label: { fontWeight: '600', color: colors.secondary, paddingHorizontal: spacing.xxxl },
  labelFilled: { color: colors.onPrimary },
  labelSoft: { color: colors.primary },
  labelDisabled: { color: colors.muted },
  thumb: {
    position: 'absolute',
    left: 0,
    top: TRACK_PADDING,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFilled: { backgroundColor: colors.surface },
  thumbDisabled: { backgroundColor: colors.muted },
});
