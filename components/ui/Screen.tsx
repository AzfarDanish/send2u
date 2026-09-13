import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
}

/**
 * Send2U screen shell: light background, safe areas, consistent padding.
 * Scrollable by default so content survives small screens.
 */
export function Screen({ children, scrollable = true, contentStyle, refreshControl, underTabs = false }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {scrollable ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            underTabs && styles.tabsClearance,
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, underTabs && styles.tabsClearance, contentStyle]}>{children}</View>
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
