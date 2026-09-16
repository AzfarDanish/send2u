import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

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
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.tile}>
          <PlaceholderImage style={styles.tileImage} />
        </View>

        <View style={styles.textBlock}>
          <Text variant="subtitle" numberOfLines={2}>
            {vendor.name}
          </Text>

          <Text
            variant="caption"
            style={vendor.isOpen ? styles.open : styles.closed}
          >
            {vendor.isOpen ? 'Open' : 'Closed'}
          </Text>

          {vendor.operatingHours ? (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {vendor.operatingHours}
            </Text>
          ) : null}
        </View>

        <MaterialIcons
          name="chevron-right"
          size={24}
          color={colors.primary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 88,
  },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  open: {
    color: colors.success,
  },
  closed: {
    color: colors.textSecondary,
  },
});