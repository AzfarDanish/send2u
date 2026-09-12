import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { formatFileSize } from '@/services/storage';

/** A picked-but-not-yet-uploaded file awaiting the user's confirmation. */
export interface StagedFile {
  /** Local URI for preview. Never uploaded or persisted. */
  uri: string;
  /** Full original filename, shown verbatim. */
  name: string;
  sizeBytes: number;
  mimeType: string;
}

interface StagedFileCardProps {
  file: StagedFile;
  title: string;
  note?: string;
  busy: boolean;
  busyMessage?: string | null;
  confirmTitle: string;
  rechooseTitle?: string;
  onConfirm: () => void;
  onRechoose: () => void;
  onCancel: () => void;
}

/**
 * Confirm-first upload review: the user sees exactly what they picked (full
 * name, size, image preview) and explicitly confirms before anything is
 * uploaded — or re-chooses / cancels. Nothing reaches Storage or the
 * database from this component; the caller uploads on `onConfirm`.
 */
export function StagedFileCard({
  file,
  title,
  note,
  busy,
  busyMessage,
  confirmTitle,
  rechooseTitle = 'Choose a different file',
  onConfirm,
  onRechoose,
  onCancel,
}: StagedFileCardProps) {
  const isImage = file.mimeType.startsWith('image/');
  return (
    <View style={styles.container}>
      <Text variant="subtitle">{title}</Text>
      {isImage ? (
        <View style={styles.previewFrame}>
          <Image source={{ uri: file.uri }} style={styles.preview} contentFit="contain" />
        </View>
      ) : (
        <View style={styles.docRow}>
          <MaterialIcons
            name={file.mimeType === 'application/pdf' ? 'picture-as-pdf' : 'insert-drive-file'}
            size={32}
            color={colors.primary}
          />
          <View style={styles.docText}>
            <Text variant="secondary" style={styles.fileName}>
              {file.name}
            </Text>
            <Text variant="caption" color="secondary">
              {formatFileSize(file.sizeBytes)} · {file.mimeType}
            </Text>
          </View>
        </View>
      )}
      {isImage ? (
        <View style={styles.meta}>
          <Text variant="secondary" style={styles.fileName} numberOfLines={2}>
            {file.name}
          </Text>
          <Text variant="caption" color="secondary">
            {formatFileSize(file.sizeBytes)}
          </Text>
        </View>
      ) : null}
      {note ? (
        <Text variant="caption" color="secondary">
          {note}
        </Text>
      ) : null}
      <Button
        title={busy ? (busyMessage ?? 'Working…') : confirmTitle}
        onPress={onConfirm}
        disabled={busy}
        loading={busy}
      />
      <Button title={rechooseTitle} variant="secondary" onPress={onRechoose} disabled={busy} />
      <Button title="Cancel" variant="tertiary" onPress={onCancel} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  previewFrame: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  preview: { width: '100%', aspectRatio: 1 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  docText: { flex: 1, gap: spacing.xs },
  meta: { gap: spacing.xs },
  fileName: { fontWeight: '600', color: colors.text },
});
