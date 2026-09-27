import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';

/**
 * Floating circular back button for full-bleed map screens.
 *
 * Unlike `HeaderBack` (which is a bare 44×44 chevron inside a native/glass
 * header), this is an on-map control: a circular, white, hairline-bordered
 * button that floats above the map's top-left corner. It is positioned by its
 * parent (a `top` safe-area + spacing), so it never owns geometry beyond its
 * own circle.
 *
 * Back restores the true origin (`backBehavior="history"`); a history-less
 * entry (deep link) falls back to the screen's own root instead of a dead
 * button. The chevron is brand red on white for contrast against any basemap.
 */
export function FloatingBackButton({
  fallbackHref,
  accessibilityLabel = 'Go back',
  replace = false,
}: {
  fallbackHref: string;
  accessibilityLabel?: string;
  /**
   * Replace instead of stepping back: for flows where history must never be
   * revisited (workspace stages advancing next-next-next), the button lands
   * on the destination directly rather than walking the stack.
   */
  replace?: boolean;
}) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          if (!replace && router.canGoBack()) router.back();
          else router.replace(fallbackHref as Href);
        }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        hitSlop={8}>
        <MaterialIcons name="chevron-left" size={26} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // The wrapper is transparent and non-blocking so the map still receives taps
  // everywhere except the button's own circle.
  wrap: { paddingHorizontal: 0 },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    // A soft shadow is the one exception to the no-shadow rule, and it is
    // load-bearing here: the button floats over arbitrary map imagery, so a
    // hairline alone would not separate it from a light tile.
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pressed: { opacity: 0.7 },
});
