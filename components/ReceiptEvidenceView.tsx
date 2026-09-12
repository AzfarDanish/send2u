import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrivateImage } from '@/components/PrivateImage';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { displayFileName, downloadStorageFile, signedImageUrl } from '@/services/storage';

/**
 * Read-only payment evidence with full filename: inline image for photos,
 * openable file row for PDFs — plus a download button in both cases so the
 * record can be saved to the device (share sheet on native). No
 * submit/verify/reject actions — history views use this so a closed order
 * can never be acted on. File access still goes through signed URLs, so
 * existing Storage authorization applies unchanged.
 */
export function ReceiptEvidenceView({ path }: { path: string }) {
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileName = displayFileName(path);

  const handleOpen = async () => {
    if (opening) return;
    setOpening(true);
    setFileError(null);
    try {
      const url = await signedImageUrl(path);
      await Linking.openURL(url);
    } catch {
      setFileError('Could not open the receipt. Try again.');
    } finally {
      setOpening(false);
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadNotice(null);
    setFileError(null);
    try {
      const outcome = await downloadStorageFile(path, setDownloadProgress);
      setDownloadNotice(
        outcome === 'shared'
          ? 'Downloaded — complete saving in the share sheet.'
          : 'Opened in the viewer — save it from there.',
      );
    } catch {
      setFileError('Could not download the receipt. Try again.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadButton = (
    <Button
      title={
        downloading
          ? downloadProgress !== null
            ? `Downloading… ${Math.round(downloadProgress * 100)}%`
            : 'Downloading…'
          : 'Download receipt'
      }
      variant="secondary"
      onPress={() => void handleDownload()}
      disabled={downloading || opening}
      loading={downloading}
    />
  );
  const downloadNoticeText = downloadNotice ? (
    <Text variant="caption" color="secondary">
      {downloadNotice}
    </Text>
  ) : null;
  const fileErrorText = fileError ? (
    <Text variant="caption" color="error">
      {fileError}
    </Text>
  ) : null;

  if (!path.toLowerCase().endsWith('.pdf')) {
    return (
      <View style={{ gap: spacing.sm }}>
        <PrivateImage path={path} accessibilityLabel="Payment receipt (historical record)" />
        <Text variant="caption" color="muted">
          {fileName}
        </Text>
        {downloadButton}
        {downloadNoticeText}
        {fileErrorText}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open receipt ${fileName}`}
        onPress={() => void handleOpen()}
        style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}>
        <MaterialIcons name="picture-as-pdf" size={28} color={colors.error} />
        <View style={styles.fileText}>
          <Text variant="secondary" style={styles.fileName} numberOfLines={1}>
            {fileName}
          </Text>
          <Text variant="caption" color="secondary">
            {opening ? 'Opening…' : 'Tap to open the PDF receipt'}
          </Text>
        </View>
        <MaterialIcons name="open-in-new" size={22} color={colors.primary} />
      </Pressable>
      {downloadButton}
      {downloadNoticeText}
      {fileErrorText}
    </View>
  );
}

const styles = StyleSheet.create({
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    minHeight: 64,
  },
  pressed: { opacity: 0.7 },
  fileText: { flex: 1, gap: spacing.xs },
  fileName: { fontWeight: '600', color: colors.text },
});
