import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { PlaceholderImage } from '@/components/PlaceholderImage';
import { Text } from '@/components/ui/Text';
import { formatMYR } from '@/lib/money';
import { colors, radii, spacing, touchTargets } from '@/constants/theme';
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

/** Menu list row: name, price, description, honest availability state. */
export function MenuItemRow({ item, showVendor = false, onPress, thumbnail = false, onAdd }: MenuItemRowProps) {
  const dimmed = !item.isAvailable;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatMYR(item.priceCents)}${item.isAvailable ? '' : ', unavailable'}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {thumbnail ? (
        <View style={styles.thumb}>
          <PlaceholderImage style={styles.thumbImage} />
        </View>
      ) : null}
      <View style={styles.textBlock}>
        <View style={styles.nameRow}>
          <Text variant="secondary" style={[styles.name, dimmed && styles.dimmed]}>
            {item.name}
          </Text>
          <Text variant="price" color="primary" style={[styles.price, dimmed && styles.dimmed]}>
            {formatMYR(item.priceCents)}
          </Text>
        </View>
        {item.description ? (
          <Text variant="caption" color="secondary" numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.badges}>
          {showVendor ? <Badge label={item.vendor.name} tone="neutral" /> : null}
          {!item.isAvailable ? <Badge label="Unavailable" tone="warning" /> : null}
        </View>
      </View>
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.name} to cart`}
          accessibilityState={{ disabled: !item.isAvailable }}
          onPress={() => onAdd(item)}
          disabled={!item.isAvailable}
          hitSlop={4}
          style={({ pressed }) => [
            styles.addButton,
            !item.isAvailable && styles.addDisabled,
            pressed && item.isAvailable && styles.pressed,
          ]}>
          <MaterialIcons
            name="add"
            size={22}
            color={item.isAvailable ? colors.onPrimary : colors.disabled}
          />
        </Pressable>
      ) : (
        <MaterialIcons name="chevron-right" size={24} color={dimmed ? colors.disabled : colors.muted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTargets.listRow,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
  },
  thumbImage: { borderRadius: radii.md },
  textBlock: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  name: { flex: 1, fontWeight: '600', color: colors.text },
  price: { fontVariant: ['tabular-nums'] as const },
  dimmed: { color: colors.disabled },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
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
