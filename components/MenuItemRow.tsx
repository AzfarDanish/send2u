import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { PlaceholderImage } from '@/components/PlaceholderImage';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatMYR } from '@/lib/money';
import { colors, radii, spacing } from '@/constants/theme';
import type { MenuItemWithVendor } from '@/types/domain';

interface MenuItemRowProps {
  item: MenuItemWithVendor;
  showVendor?: boolean;
  onPress: (item: MenuItemWithVendor) => void;
  /** Grey placeholder thumb (no food imagery exists in the product). */
  thumbnail?: boolean;
  /** Quick-add action; renders a red + button instead of the chevron. */
  onAdd?: (item: MenuItemWithVendor) => void;
}

/** Floating food card: landscape visual, stacked name + price, bottom-right action. */
export function MenuItemRow({ item, showVendor = false, onPress, thumbnail = false, onAdd }: MenuItemRowProps) {
  const dimmed = !item.isAvailable;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatMYR(item.priceCents)}${item.isAvailable ? '' : ', unavailable'}`}
      onPress={() => onPress(item)}
      haptic="selection"
      style={styles.card}>
      {thumbnail ? (
        <View style={styles.imageWrap}>
          <PlaceholderImage style={styles.image} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text variant="subtitle" style={[dimmed && styles.dimmed]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text variant="price" color="primary" style={[styles.price, dimmed && styles.dimmed]}>
          {formatMYR(item.priceCents)}
        </Text>
        {item.description ? (
          <Text variant="caption" color="secondary" numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.badges}>
          {showVendor ? <Badge label={item.vendor.name} tone="neutral" /> : null}
          {!item.isAvailable ? <Badge label="Unavailable" tone="warning" /> : null}
        </View>
        <View style={styles.actionRow}>
          {onAdd ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name} to cart`}
              accessibilityState={{ disabled: !item.isAvailable }}
              onPress={() => onAdd(item)}
              disabled={!item.isAvailable}
              hitSlop={8}
              haptic="light"
              style={[styles.addButton, !item.isAvailable && styles.addDisabled]}>
              <MaterialIcons
                name="add"
                size={22}
                color={item.isAvailable ? colors.onPrimary : colors.disabled}
              />
            </PressableScale>
          ) : (
            <MaterialIcons name="chevron-right" size={24} color={dimmed ? colors.disabled : colors.muted} />
          )}
        </View>
      </View>
    </PressableScale>
  );
}
const styles = StyleSheet.create({
  // Floating food card: bordered white surface with a soft ambient shadow.
  // Explicit, approved exception to the otherwise shadow-free system.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  imageWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceSecondary,
  },
  image: { width: '100%', height: '100%' },
  body: { padding: spacing.lg, gap: spacing.sm },
  price: { fontVariant: ['tabular-nums'] as const },
  dimmed: { color: colors.disabled },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDisabled: { backgroundColor: colors.disabledBackground },
});
