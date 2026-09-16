import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

<<<<<<< HEAD
=======
import { Card } from '@/components/ui/Card';
>>>>>>> parent of 9dd0d80 (refactor: standardize headers, backgrounds, and cardless UI)
import { PlaceholderImage } from '@/components/PlaceholderImage';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import type { Vendor } from '@/types/domain';

interface VendorCardProps {
  vendor: Vendor;
  onPress: (vendor: Vendor) => void;
}

/** First letters of the first two words, e.g. "Warung Fiksyen" → "WF". */
export function vendorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0)).join('');
  return (letters || '?').toUpperCase();
}

/**
 * Vendor discovery row: grey initials tile covering the full left edge
 * (no vendor imagery exists in the product), name, plain-text open state
 * and hours, and a navigation affordance. The whole row is one large
 * touch target.
 */
export function VendorCard({ vendor, onPress }: VendorCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${vendor.name}${vendor.isOpen ? '' : ', closed'}`}
      onPress={() => onPress(vendor)}
      style={({ pressed }) => [pressed && styles.pressed]}>
<<<<<<< HEAD
      <View style={styles.row}>
=======
      <Card style={styles.card}>
>>>>>>> parent of 9dd0d80 (refactor: standardize headers, backgrounds, and cardless UI)
        <View style={styles.tile}>
          <PlaceholderImage style={styles.tileImage} />
        </View>
        <View style={styles.textBlock}>
          <Text variant="subtitle" numberOfLines={2}>
            {vendor.name}
          </Text>
          <Text variant="caption" style={vendor.isOpen ? styles.open : styles.closed}>
            {vendor.isOpen ? 'Open' : 'Closed'}
          </Text>
          {vendor.operatingHours ? (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {vendor.operatingHours}
            </Text>
          ) : null}
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
<<<<<<< HEAD
      </View>
=======
      </Card>
>>>>>>> parent of 9dd0d80 (refactor: standardize headers, backgrounds, and cardless UI)
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 88,
    paddingVertical: spacing.sm,
  },
  tile: {
    width: 88,
    height: 88,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
  },
  tileImage: { width: 88, height: 88 },
  textBlock: { flex: 1, gap: spacing.xs, paddingVertical: spacing.md },
  open: { color: colors.success },
  closed: { color: colors.warning },
});
