import type { ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/lib/layout';

/** White sheet overlap over the red header; matches Home's sheet geometry. */
const SHEET_OVERLAP = 20;
const SHEET_RADIUS = 20;

interface RedScreenProps {
  title: string;
  /** Rendered before the title (back chevron on pushed screens). */
  leading?: ReactNode;
  /** Rendered at the end of the title row (bell, settings, text action). */
  right?: ReactNode;
  /** Supporting line under the title, inside the red area. */
  subtitle?: string;
  /** Extra content under the title, still inside the red area. */
  below?: ReactNode;
  children: ReactNode;
  /** Pull-to-refresh control for data screens. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /**
   * Set on bottom-tab roots: reserves one tab height of trailing clearance so
   * the final row is never hidden behind the tab bar (design.md §5).
   */
  underTabs?: boolean;
  /** Disable when the screen manages its own scrolling. Defaults to true. */
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Red-header screen shell for the non-image-header tabs (My Orders, Profile)
 * and the notification feed.
 *
 * One construction everywhere: the brand red extends behind the status bar, a
 * white sheet with rounded top corners overlaps the header bottom by 20, and
 * the content scrolls inside it. That is the same header/sheet pairing Home
 * uses, which is what keeps the four screens reading as one application.
 *
 * No gradients, no shadows, no decorative shapes: the red block is a header,
 * not a banner, so it sizes to its content (title row plus any subtitle or
 * `below` slot) and never claims empty vertical space.
 */
export function RedScreen({
  title,
  leading,
  right,
  subtitle,
  below,
  children,
  refreshControl,
  underTabs = false,
  scrollable = true,
  contentStyle,
}: RedScreenProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = underTabs ? TAB_BAR_CONTENT_CLEARANCE : spacing.xxxl;

  return (
    <View style={styles.root}>
      <View
        style={[styles.header, { paddingTop: insets.top }]}
        accessibilityRole="header"
        accessibilityLabel={title}>
        <View style={styles.titleRow}>
          {leading ? <View style={styles.leading}>{leading}</View> : null}
          <Text variant="display" color="onPrimary" style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
        {subtitle ? (
          <Text color="onPrimary" style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {below}
      </View>

      <View style={styles.sheet}>
        {scrollable ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: bottomPad },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.flex, { paddingBottom: bottomPad }, contentStyle]}>
            {children}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
  },
  leading: { marginLeft: -spacing.sm },
  title: { flexShrink: 1 },
  right: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subtitle: { marginTop: spacing.xs, opacity: 0.92 },
  // White sheet: rounded top corners only, overlapping the red header bottom.
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    marginTop: -SHEET_OVERLAP,
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl + SHEET_OVERLAP,
    gap: spacing.md,
  },
});
