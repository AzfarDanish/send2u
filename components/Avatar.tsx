import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radii } from '@/constants/theme';
import { signedImageUrl } from '@/services/storage';

interface AvatarProps {
  /** Display name used for the initials fallback. */
  name: string | null | undefined;
  /** Private Storage object path (`avatar/<uid>/…`); null shows initials. */
  path: string | null | undefined;
  /** Local URI shown immediately (e.g. pre-upload preview); wins over `path`. */
  previewUri?: string | null;
  size?: number;
  accessibilityLabel?: string;
}

function initialsFor(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  return `${parts[0]?.charAt(0) ?? ''}${parts[parts.length - 1]?.charAt(0) ?? ''}`.toUpperCase();
}

/**
 * Circular profile photo with an initials fallback. A missing, loading, or
 * failed photo all render clean initials — a tiny circle never shows error
 * text or a spinner. Solid brand background keeps white initials readable.
 */
export function Avatar({ name, path, previewUri, size = 88, accessibilityLabel }: AvatarProps) {
  const [url, setUrl] = useState<string | null>(null);
  // Reset during render when the path changes (the React-endorsed
  // alternative to setState-in-effect); the effect below then only signs
  // the new URL. Inert on mount: the initial values already match.
  const [seenPath, setSeenPath] = useState(path);
  if (seenPath !== path) {
    setSeenPath(path);
    setUrl(null);
  }
  const shownUri = previewUri || url;

  useEffect(() => {
    if (!path) return;
    let mounted = true;
    (async () => {
      try {
        const signed = await signedImageUrl(path);
        if (mounted) setUrl(signed);
      } catch {
        // Fall through to initials; the photo simply stays hidden.
      }
    })();
    return () => {
      mounted = false;
    };
  }, [path]);

  const label = accessibilityLabel ?? (name ? `Profile photo of ${name}` : 'Profile photo');
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.circle, { width: size, height: size, borderRadius: radii.full }]}>
      {shownUri ? (
        <Image
          source={{ uri: shownUri }}
          style={{ width: size, height: size, borderRadius: radii.full }}
          contentFit="cover"
          accessibilityLabel={label}
        />
      ) : (
        <Text variant="title" style={[styles.initials, { fontSize: size * 0.36 }]}>
          {initialsFor(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { color: colors.onPrimary, fontWeight: '700' },
});
