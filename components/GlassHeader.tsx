import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderBack } from '@/components/HeaderBack';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';

/** Content-row height of the glass header (inset is added on top). */
export const GLASS_HEADER_ROW = 48;

interface GlassHeaderProps {
  title: string;
  /** Deep-link fallback when there is no history to pop. */
  fallbackHref?: string;
  /** Right-side action (bell, mark-read, settings…). Bell is opt-in per screen. */
  right?: React.ReactNode;
  accessibilityLabel?: string;
  /** Back chevron label (e.g. "Back to Home" over a hero). */
  backLabel?: string;
  /** `dark` renders white content over imagery (vendor hero). */
  tone?: 'light' | 'dark';
}

/**
 * Reusable translucent header for secondary screens: absolute-positioned
 * blur over scrolling content (Apple-style), safe-area aware, 44pt+ back
 * chevron, absolutely-centered title, optional right action. Screens using
 * it hide the native header and render `Screen beneathHeader` so content
 * starts below the glass and slides behind it on scroll.
 * 
 * Updated: Soft, faded background treatment with minimal blur for a cleaner look.
 * The header blends naturally into the white app background without visible boundaries.
 */
export function GlassHeader({
  title,
  fallbackHref = '/(requester)',
  right,
  accessibilityLabel,
  backLabel,
  tone = 'light',
}: GlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const dark = tone === 'dark';
  return (
    <View
      style={[styles.position, { height: insets.top + GLASS_HEADER_ROW }]}
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel ?? title}
      // Chrome must not swallow touches: only the back/right controls are
      // interactive — taps anywhere else fall through to content sliding
      // underneath (e.g. a pinned filter bar stays usable under the blur).
      pointerEvents="box-none">
      <BlurView
        intensity={15}
        tint={dark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Soft faded background overlay - subtle white tint that blends with app background */}
      <View 
        style={[
          styles.backgroundOverlay,
          dark && styles.backgroundOverlayDark
        ]} 
        pointerEvents="none" 
      />
      <View style={[styles.row, { paddingTop: insets.top }]}>
        <View style={styles.side}>
          <HeaderBack
            fallbackHref={fallbackHref}
            color={dark ? colors.onPrimary : undefined}
            accessibilityLabel={backLabel}
          />
        </View>
        <View style={styles.titleWrap} pointerEvents="none">
          <Text
            variant="subtitle"
            style={[styles.title, dark && styles.titleDark]}
            numberOfLines={1}
            ellipsizeMode="tail">
            {title}
          </Text>
        </View>
        <View style={[styles.side, styles.right]}>{right}</View>
      </View>
      {/* Subtle separator at bottom edge - removed for cleaner floating appearance */}
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: { minWidth: 48, justifyContent: 'center', zIndex: 1 },
  right: { flex: 1, alignItems: 'flex-end', paddingRight: spacing.sm },
  titleWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: (GLASS_HEADER_ROW - 24) / 2,
  },
  title: { color: colors.text },
  titleDark: { color: colors.onPrimary },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  backgroundOverlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
});
