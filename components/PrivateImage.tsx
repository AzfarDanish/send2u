import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { LoadingState } from '@/components/ui/LoadingState';
import { Text } from '@/components/ui/Text';
import { colors, radii } from '@/constants/theme';
import { signedImageUrl } from '@/services/storage';

interface PrivateImageProps {
  /** Storage object path inside the private bucket. */
  path: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders a private Storage image via a short-lived signed URL.
 * Loading and failure states included; never exposes the raw path.
 */
export function PrivateImage({ path, accessibilityLabel, style }: PrivateImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setUrl(null);
    setFailed(false);
    (async () => {
      try {
        const signed = await signedImageUrl(path);
        if (mounted) setUrl(signed);
      } catch {
        if (mounted) setFailed(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [path]);

  if (failed) {
    return (
      <View style={[styles.fallback, style]}>
        <Text variant="caption" color="secondary">
          Image unavailable — try again later.
        </Text>
      </View>
    );
  }
  if (!url) {
    return (
      <View style={[styles.fallback, style]}>
        <LoadingState message="Loading image…" />
      </View>
    );
  }
  return (
    <View style={[styles.frame, style]}>
      <Image
        source={{ uri: url }}
        style={styles.image}
        contentFit="contain"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  image: { width: '100%', aspectRatio: 1 },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    minHeight: 180,
    padding: 16,
  },
});
