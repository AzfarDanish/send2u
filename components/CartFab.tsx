import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, touchTargets } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';

interface CartFabProps {
  /** True on bottom-tab roots where the floating tab bar sits below. */
  aboveTabs?: boolean;
}

/**
 * Floating cart shortcut: red circle, bottom-right, visible only while
 * the cart holds items. Rendered as a sibling after `Screen` so it
 * overlays scroll content. Never rendered on Profile.
 */
export function CartFab({ aboveTabs = false }: CartFabProps) {
  const { count } = useCart();
  const insets = useSafeAreaInsets();

  if (count <= 0) return null;

  return (
    <View
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
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open cart, ${count} items`}
        onPress={() => router.push('/(requester)/create')}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}>
        <MaterialIcons name="shopping-cart" size={26} color={colors.onPrimary} />
        <View style={styles.countBadge}>
          <Text variant="caption" style={styles.countText}>
            {count > 99 ? '99+' : String(count)}
          </Text>
        </View>
      </Pressable>
    </View>
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
  pressed: { opacity: 0.85 },
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
