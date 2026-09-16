import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';

/** Flat content group — no surface, border, radius, or shadow.
 * Content separates through whitespace and typography. */
export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.wrapper, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
});
