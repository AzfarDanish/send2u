import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radii } from '@/constants/theme';

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  return `${parts[0]?.charAt(0) ?? ''}${parts[1]?.charAt(0) ?? ''}`.toUpperCase();
}

interface VendorMarkProps {
  name: string;
  size?: number;
}

/**
 * Circular vendor identifier for job rows. Vendors carry no imagery in
 * this product, so the mark derives initials from the real vendor name —
 * never invented artwork. Fixed geometry keeps every row the same height.
 */
export function VendorMark({ name, size = 56 }: VendorMarkProps) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[styles.circle, { width: size, height: size, borderRadius: radii.full }]}>
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initialsFor(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.primary, fontWeight: '700' },
});
