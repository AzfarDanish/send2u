import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GLASS_HEADER_ROW } from '@/components/GlassHeader';
import { colors, spacing, touchTargets } from '@/constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  /** Disable when the screen manages its own scrolling. Defaults to true. */
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Optional pull-to-refresh control for data screens. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /**
   * Set on bottom-tab root screens: reserves one tab-bar height of extra
   * bottom clearance so scrolled content ends behind a floating tab bar
   * instead of clipping above it. Leave off for pushed (stack) screens.
   */
  underTabs?: boolean;
  /** Indices of children to pin while scrolling (e.g. a filter bar). */
  stickyHeaderIndices?: number[];
  /** Scroll listener (e.g. collapsing headers). Throttled to animation frames. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * Set when the screen renders a `GlassHeader`: the top safe-area inset is
   * dropped (the glass owns it) and content starts below the glass, sliding
   * behind it on scroll. Never combined with the native header.
   */
  beneathHeader?: boolean;
}

/**
 * Send2U screen shell: light background, safe areas, consistent padding.
 * Scrollable by default so content survives small screens.
 */
export function Screen({ children, scrollable = true, contentStyle, refreshControl, underTabs = false, stickyHeaderIndices, beneathHeader = false, onScroll }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView
      style={styles.safe}
      edges={beneathHeader ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}>
      {scrollable ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            underTabs && styles.tabsClearance,
            beneathHeader && {
              paddingTop: insets.top + GLASS_HEADER_ROW + spacing.md,
            },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={stickyHeaderIndices}
          refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={onScroll ? 16 : undefined}>
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.content,
            underTabs && styles.tabsClearance,
            beneathHeader && {
              paddingTop: insets.top + GLASS_HEADER_ROW + spacing.md,
            },
            contentStyle,
          ]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  tabsClearance: { paddingBottom: spacing.xxxl + touchTargets.tabBar },
});
