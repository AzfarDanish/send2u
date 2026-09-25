import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/constants/theme';

/**
 * Header gear; opens this role's settings screen. `color` exists because the
 * gear now renders on both the white in-content header and the red tab
 * headers, and a near-black glyph is unreadable on the brand red.
 */
export function HeaderSettings({
  href,
  color = colors.text,
}: {
  href: '/(requester)/settings';
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      hitSlop={8}>
      <MaterialIcons name="settings" size={26} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
