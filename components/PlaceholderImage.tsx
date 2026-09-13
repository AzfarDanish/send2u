import { Image } from 'expo-image';
import { StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

/**
 * Temporary diagnostic placeholder: renders the developer-supplied root
 * `placeholder.png` in every image slot so layout problems are visible.
 * Avatars, icons, and functional tinted surfaces are intentionally NOT
 * swapped — only true image-content slots use this.
 */
export function PlaceholderImage({ style }: { style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require('../placeholder.png')}
      style={[styles.image, style]}
      contentFit="cover"
      accessibilityLabel="Placeholder image"
    />
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
});
