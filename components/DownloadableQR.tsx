import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PrivateImage } from '@/components/PrivateImage';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { displayFileName, downloadStorageFile } from '@/services/storage';

interface DownloadableQRProps {
  /** Storage object path inside the private bucket. */
  path: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Displays a private QR code image with a compact download icon button.
 * Tapping the download icon saves the QR to the device (share sheet on native).
 * Minimalist design: icon-only button, no text labels.
 */
export function DownloadableQR({ path, accessibilityLabel, style }: DownloadableQRProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadStorageFile(path);
    } catch {
      setDownloadError('Could not download the QR. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  const fileName = displayFileName(path);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.imageWrapper}>
        <PrivateImage path={path} accessibilityLabel={accessibilityLabel} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Download ${fileName}`}
          onPress={() => void handleDownload()}
          disabled={downloading}
          hitSlop={8}
          style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="download" size={20} color={colors.primary} />
          )}
        </Pressable>
      </View>
      {downloadError ? (
        <Text variant="caption" color="error" style={styles.errorText}>
          {downloadError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  imageWrapper: {
    position: 'relative',
  },
  downloadButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  errorText: {
    textAlign: 'center',
  },
});
