import { StyleSheet, View, type ViewProps } from 'react-native';

import { spacing } from '@/constants/theme';

/**
 * Flat grouping container. No surface, border, radius, or padding — content
 * separates through whitespace and typography, matching the Apple-inspired
 * layout system. Children stack with a small vertical gap.
 */
export function Section({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.section, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});