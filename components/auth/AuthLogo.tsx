import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

interface AuthLogoProps {
  /** Display size in points. Restrained by design; the wordmark must not dominate. */
  size?: number;
}

/**
 * Minimal auth brand mark: the existing Send2U wordmark image clipped to a
 * solid red rounded square. No icon, subtitle, border, or shadow.
 */
export function AuthLogo({ size = 120 }: AuthLogoProps) {
  const radius = Math.round(size * 0.24);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Send2U"
      style={[styles.frame, { width: size, height: size, borderRadius: radius }]}>
      <Image
        source={require('../../assets/images/icon.png')}
        style={{ width: size, height: size }}
        contentFit="cover"
        accessibilityLabel="Send2U logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
