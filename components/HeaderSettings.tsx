import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/constants/theme';

/** Header gear; opens this role's settings screen. */
export function HeaderSettings({ href }: { href: '/(requester)/settings' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      hitSlop={8}>
      <MaterialIcons name="settings" size={26} color={colors.text} />
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
