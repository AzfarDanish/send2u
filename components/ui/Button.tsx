import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, radii, spacing, touchTargets, typography } from '@/constants/theme';
import { pressDurationMs, pressScale, springDefault } from '@/constants/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Text } from '@/components/ui/Text';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const labelColor: Record<ButtonVariant, string> = {
  primary: colors.onPrimary,
  secondary: colors.primary,
  tertiary: colors.primary,
  danger: colors.error,
};

/**
 * Send2U button. Minimum 52pt height; `disabled` dims via tokens
 * (never by opacity alone on the label — color tokens change too).
 * Apple §1: instant scale feedback on pointer-down, spring back on
 * release (transform-only, interruptible); reduced-motion falls back to
 * the opacity pressed style.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ title, variant = 'primary', loading = false, disabled, style, onPressIn, onPressOut, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPressIn={(e) => {
        if (!isDisabled) {
          if (reduced) {
            // Reanimated shared-value write (UI-thread spring input) — intended API.
            // eslint-disable-next-line react-hooks/immutability
            opacity.value = withTiming(0.6, { duration: pressDurationMs });
          } else {
            // Reanimated shared-value write (UI-thread spring input) — intended API.
            // eslint-disable-next-line react-hooks/immutability
            scale.value = withTiming(pressScale, { duration: pressDurationMs });
          }
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!isDisabled) {
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
        onPressOut?.(e);
      }}
      style={[
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        style,
        animatedStyle,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />
      ) : (
        <Text variant="button" color={isDisabled ? 'disabled' : labelColor[variant]}>
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTargets.button,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...typography.button,
  },
  primary: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  tertiary: { backgroundColor: 'transparent', minHeight: 48 },
  danger: { backgroundColor: 'transparent', minHeight: 48 },
  disabled: {
    backgroundColor: colors.disabledBackground,
    borderColor: colors.disabledBackground,
  },
});
