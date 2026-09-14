import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/constants/theme';

/**
 * Header back chevron for the Tabs default header. The vendored bottom-tabs
 * navigator never injects a `back` option into its header, so no tab screen
 * shows a native back button on its own — this is wired per screen via
 * `headerLeft`.
 */
export function HeaderBack({ fallbackHref }: { fallbackHref: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={() => {
        // Back restores the true origin (backBehavior="history"); a
        // history-less entry (deep link) falls back to the role root
        // instead of a dead button.
        if (router.canGoBack()) router.back();
        else router.replace(fallbackHref as Href);
      }}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      hitSlop={8}>
      <MaterialIcons name="chevron-left" size={26} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});