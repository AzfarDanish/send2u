import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrivateImage } from '@/components/PrivateImage';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { signedImageUrl } from '@/services/storage';

/**
 * Read-only payment evidence: inline image for photos, openable file row
 * for PDFs. No submit/verify/reject actions — history views use this so a
 * closed order can never be acted on. File access still goes through
 * signed URLs, so existing Storage authorization applies unchanged.
 */
export function ReceiptEvidenceView({ path }: { path: string }) {
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  if (!path.toLowerCase().endsWith('.pdf')) {
    return <PrivateImage path={path} accessibilityLabel="Payment receipt (historical record)" />;
  }

  const fileName = path.split('/').pop() ?? 'receipt.pdf';
  const handleOpen = async () => {
    if (opening) return;
    setOpening(true);
    setOpenError(null);
    try {
      const url = await signedImageUrl(path);
      await Linking.openURL(url);
    } catch {
      setOpenError('Could not open the receipt. Try again.');
    } finally {
      setOpening(false);
    }
  };

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
      {openError ? (
        <Text variant="caption" color="error">
          {openError}
        </Text>
      ) : null}
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
