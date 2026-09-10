import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { formatMYR } from '@/lib/money';
import { colors, spacing, touchTargets } from '@/constants/theme';
import type { MenuItemWithVendor } from '@/types/domain';

interface MenuItemRowProps {
  item: MenuItemWithVendor;
  showVendor?: boolean;
  onPress: (item: MenuItemWithVendor) => void;
}

/** Menu list row: name, price, description, honest availability state. */
export function MenuItemRow({ item, showVendor = false, onPress }: MenuItemRowProps) {
  const dimmed = !item.isAvailable;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${formatMYR(item.priceCents)}${item.isAvailable ? '' : ', unavailable'}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.textBlock}>
        <View style={styles.nameRow}>
          <Text variant="secondary" style={[styles.name, dimmed && styles.dimmed]}>
            {item.name}
          </Text>
          <Text variant="secondary" style={[styles.price, dimmed && styles.dimmed]}>
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
      <MaterialIcons name="chevron-right" size={24} color={dimmed ? colors.disabled : colors.muted} />
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
  textBlock: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  name: { flex: 1, fontWeight: '600', color: colors.text },
  price: { fontWeight: '700', color: colors.primary },
  dimmed: { color: colors.disabled },
  badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
});
