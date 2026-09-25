import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { pressDurationMs, springDefault } from '@/constants/motion';
import { colors, radii, spacing, touchTargets } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useCart } from '@/contexts/CartContext';
import { useEffect } from 'react';

interface CartFabProps {
  /** True on bottom-tab roots where the floating tab bar sits below. */
  aboveTabs?: boolean;
}

/**
 * Floating cart shortcut: red circle, bottom-right, visible only while
 * the cart holds items. Rendered as a sibling after `Screen` so it
 * overlays scroll content. Never rendered on Profile.
 *
 * Apple continuity: spring scale+fade enter/exit (same bottom path both
 * ways), badge pops on count change, press springs from the live value.
 */
export function CartFab({ aboveTabs = false }: CartFabProps) {
  const { count } = useCart();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const enter = useSharedValue(0);
  const badge = useSharedValue(1);

  useEffect(() => {
    if (count > 0) {
      enter.value = reduced
        ? withTiming(1, { duration: pressDurationMs })
        : withSpring(1, { ...springDefault });
    } else {
      enter.value = withTiming(0, { duration: pressDurationMs });
    }
  }, [count, enter, reduced]);

  useEffect(() => {
    if (count > 0) {
      badge.value = withTiming(1.25, { duration: pressDurationMs });
      const t = setTimeout(() => {
        badge.value = reduced
          ? withTiming(1, { duration: pressDurationMs })
          : withSpring(1, { ...springDefault });
      }, pressDurationMs);
      return () => clearTimeout(t);
    }
  }, [badge, count, reduced]);

  const layerStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.6 + 0.4 * enter.value }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badge.value }],
  }));

  if (count <= 0) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
        style={[
          styles.layer,
          // Mirror the 20pt right gap below the button (and above the tab
          // bar on tab roots) so it floats evenly in the corner.
          {
            bottom:
              Math.max(insets.bottom, 0) +
              spacing.xl +
              (aboveTabs ? touchTargets.tabBar : 0),
          },
          layerStyle,
        ]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Open cart, ${count} items`}
        onPress={() => router.push('/(requester)/create')}
        haptic="selection"
        style={styles.fab}>
        <MaterialIcons name="shopping-cart" size={26} color={colors.onPrimary} />
        <Animated.View style={[styles.countBadge, badgeStyle]}>
          <Text variant="caption" style={styles.countText}>
            {count > 99 ? '99+' : String(count)}
          </Text>
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 24,
    height: 24,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: { fontWeight: '700', color: colors.primary },
});
