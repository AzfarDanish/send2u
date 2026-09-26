import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';

/**
 * Fixed bottom action bar — the shared "bottom sheet that never moves".
 *
 * Fixed position, non-resizable, non-draggable: it owns the window bottom
 * with a hairline separator and safe-area clearance, and hosts whatever the
 * screen docks there (usually one primary button, optionally a transient
 * error line or a secondary action). Screens keep their content in a sibling
 * scroll view; this bar never scrolls, never collapses, and never overlaps
 * content — the scroll view above it carries matching bottom clearance.
 *
 * Replaces each screen's hand-rolled docked footer so the checkout-adjacent
 * flows (review, pay-online, drop-off pin, set-location, confirm) share one
 * chrome instead of five approximations.
 */
export function DockedActionBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
});
