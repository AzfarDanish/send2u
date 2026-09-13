import { StyleSheet, View, type DimensionValue } from 'react-native';

import { colors, radii } from '@/constants/theme';

interface SkeletonProps {
  /** Fixed width (number or percent). Defaults to full width. */
  width?: DimensionValue;
  /** Fixed height. Defaults to a single text line. */
  height?: number;
  /** Corner treatment. Defaults to small controls. */
  radius?: number;
  /** Screen-reader label for the loading region. */
  label?: string;
}

/**
 * Static loading placeholder (design.md §6). Deliberately motion-free
 * (reduced-motion safe by construction); list screens adopt these in
 * later phases instead of bare spinners where space is known.
 */
export function Skeleton({ width = '100%', height = 18, radius = radii.sm, label }: SkeletonProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading content'}
      style={[styles.block, { width, height, borderRadius: radius }]}
    />
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceSecondary },
});
