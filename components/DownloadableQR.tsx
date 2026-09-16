import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrivateImage } from '@/components/PrivateImage';
import { colors, radii, spacing } from '@/constants/theme';
import { displayFileName, downloadStorageFile } from '@/services/storage';
import { Text } from '@/components/ui/Text';

interface DownloadableQRProps {
  /** Storage object path inside the private bucket. */
  path: string;
  accessibilityLabel: string;
}

/**
 * Displays a private QR code image with a compact download icon button.
 * Tapping the download icon saves the QR to the device (share sheet on native).
 * Minimalist design: icon-only button, no text labels.
 */
export function DownloadableQR({ path, accessibilityLabel }: DownloadableQRProps) {
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
    <View style={styles.container}>
      <View style={styles.imageWrapper}>
        <PrivateImage path={path} accessibilityLabel={accessibilityLabel} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Download ${fileName}`}
          onPress={() => void handleDownload()}
          disabled={downloading}
          style={({ pressed }) => [styles.downloadButton, pressed && styles.pressed]}
        >
          <MaterialIcons
            name={downloading ? 'hourglass-empty' : 'download'}
            size={20}
            color={colors.primary}
          />
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
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    padding: spacing.sm,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  pressed: {
    opacity: 0.7,
  },
  errorText: {
    textAlign: 'center',
  },
});
