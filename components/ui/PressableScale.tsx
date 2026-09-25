import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { pressDurationMs, pressScale, springDefault } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type HapticKind = 'selection' | 'light' | null;

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'onPress'> {
  children: React.ReactNode;
  onPress?: PressableProps['onPress'];
  style?: StyleProp<ViewStyle>;
  /**
   * Press-down scale. Defaults to 0.97 (Apple §1). Rows/cards use the
   * same value so everything compresses identically under the finger.
   */
  scaleTo?: number;
  /** Subtle-policy haptic on commit (press release that fires onPress). */
  haptic?: HapticKind;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function fireHaptic(kind: HapticKind): void {
  if (kind === null || kind === undefined) return;
  try {
    if (kind === 'selection') void Haptics.selectionAsync();
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Best-effort: haptics never block the press.
  }
}

/**
 * Apple §1–§3 press primitive: instant scale feedback on pointer-down,
 * spring back on release, interruptible mid-flight (Reanimated shared
 * value animates from the live presentation value, transform-only so it
 * stays on the compositor). Reduced-motion falls back to a short opacity
 * cross-fade with no scale. Layout styles live on the pressable itself,
 * so row/card flex geometry is preserved.
 */
export function PressableScale({
  children,
  onPress,
  style,
  scaleTo = pressScale,
  haptic = null,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      if (!disabled) {
        if (reduced) {
          // Reanimated shared-value write (UI-thread spring input) — intended API.
          // eslint-disable-next-line react-hooks/immutability
          opacity.value = withTiming(0.6, { duration: pressDurationMs });
        } else {
          // Reanimated shared-value write (UI-thread spring input) — intended API.
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withTiming(scaleTo, { duration: pressDurationMs });
        }
      }
      onPressIn?.(event);
    },
    [disabled, onPressIn, opacity, reduced, scale, scaleTo],
  );

  const handlePressOut = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      if (!disabled) {
        if (reduced) {
          // Reanimated shared-value write (UI-thread spring input) — intended API.
          // eslint-disable-next-line react-hooks/immutability
          opacity.value = withTiming(1, { duration: pressDurationMs });
        } else {
          // Reanimated shared-value write (UI-thread spring input) — intended API.
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withSpring(1, { ...springDefault });
        }
      }
      onPressOut?.(event);
    },
    [disabled, onPressOut, opacity, reduced, scale],
  );

  const handlePress = useCallback(
    (event: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
      fireHaptic(haptic);
      onPress?.(event);
    },
    [haptic, onPress],
  );

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
