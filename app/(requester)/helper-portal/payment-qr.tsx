import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DownloadableQR } from '@/components/DownloadableQR';
import { GlassHeader } from '@/components/GlassHeader';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { StagedFileCard } from '@/components/StagedFileCard';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { setPaymentQrPath } from '@/services/auth';
import { pickPaymentImage, qrPathFor, removeObject, uploadObject, type PickedImage } from '@/services/storage';

/**
 * Payment QR inside Helper Portal. Same bucket, paths, staged confirm-first
 * upload, preview, replace/remove, and orphan cleanup as the legacy helper
 * profile manager — extracted into a dedicated screen.
 */
export default function PortalPaymentQrScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [qrBusy, setQrBusy] = useState(false);
  const [qrBusyMessage, setQrBusyMessage] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [stagedQr, setStagedQr] = useState<PickedImage | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const handleQrChoose = useCallback(async () => {
    if (!user || qrBusy) return;
    setQrBusy(true);
    setQrBusyMessage('Choosing image…');
    setQrError(null);
    try {
      const picked = await pickPaymentImage();
      if (picked) setStagedQr(picked);
    } catch (error) {
      setQrError(error instanceof Error ? error.message : 'Could not choose the QR code.');
    } finally {
      setQrBusy(false);
      setQrBusyMessage(null);
    }
  }, [user, qrBusy]);

  const handleQrConfirm = useCallback(async () => {
    if (!user || qrBusy || !stagedQr) return;
    setQrBusy(true);
    setQrError(null);
    const previous = profile?.paymentQrPath ?? null;
    let removedPrevious = false;
    let uploadedPath: string | null = null;
    let pointerUpdated = false;
    try {
      // Replace means remove-first: the old object goes before the new one
      // is saved, so a change never leaves two live QR files behind.
      if (previous) {
        setQrBusyMessage('Removing old QR…');
        try {
          await removeObject(previous);
        } catch {
          throw new Error('Could not remove the old QR code. Nothing was changed. Try again.');
        }
        removedPrevious = true;
      }
      const path = qrPathFor(user.id, stagedQr.extension, stagedQr.name);
      setQrBusyMessage('Uploading QR…');
      try {
        await uploadObject(path, stagedQr);
      } catch {
        throw new Error(
          removedPrevious
            ? 'The old QR was removed but the new upload failed. Please choose the QR again.'
            : 'Upload failed. Nothing was changed. Try again.',
        );
      }
      uploadedPath = path;
      try {
        await setPaymentQrPath(path);
      } catch {
        throw new Error(
          removedPrevious
            ? 'The old QR was removed but the new one could not be saved. Please upload again.'
            : 'Could not update the QR code. Try again.',
        );
      }
      pointerUpdated = true;
      setStagedQr(null);
      await refreshProfile();
    } catch (error) {
      if (uploadedPath && !pointerUpdated) {
        try {
          await removeObject(uploadedPath);
        } catch {
          // Orphaned upload without a pointer; retrying the change covers it.
        }
      }
      if (removedPrevious && !pointerUpdated) {
        // The profile may still reference the deleted file: clear it so the
        // UI shows "No QR" instead of a broken image.
        try {
          await setPaymentQrPath(null);
        } catch {
          // Reported below; retrying the change clears it.
        }
      }
      setQrError(error instanceof Error ? error.message : 'Could not update the QR code.');
    } finally {
      setQrBusy(false);
      setQrBusyMessage(null);
    }
  }, [user, qrBusy, stagedQr, profile, refreshProfile]);

  const handleQrRemove = useCallback(async () => {
    if (!user || qrBusy) return;
    const current = profile?.paymentQrPath ?? null;
    if (!current) return;
    setQrBusy(true);
    setQrError(null);
    try {
      await setPaymentQrPath(null);
      try {
        await removeObject(current);
      } catch {
        // File already gone or transient failure; the profile is cleared.
      }
      setConfirmingRemove(false);
      await refreshProfile();
    } catch (error) {
      setQrError(error instanceof Error ? error.message : 'Could not remove the QR code.');
    } finally {
      setQrBusy(false);
    }
  }, [user, qrBusy, profile?.paymentQrPath, refreshProfile]);

  const hasQr = Boolean(profile?.paymentQrPath);
  const managing = hasQr && !stagedQr;

  return (
    <HelperPortalGuard title="Payment QR">
      <GlassHeader title="Payment QR" fallbackHref="/(requester)" />
      <Screen beneathHeader>
        <View style={styles.hero}>
          {profile?.paymentQrPath ? (
            <View style={styles.qrWrap}>
              <DownloadableQR path={profile.paymentQrPath} accessibilityLabel="Your payment QR code" />
            </View>
          ) : (
            <View accessibilityRole="image" accessibilityLabel="No payment QR set" style={styles.emptyEmblem}>
              <MaterialIcons name="qr-code-2" size={40} color={colors.primary} />
            </View>
          )}
          <Text variant="subtitle" style={styles.center}>
            {profile?.paymentQrPath ? 'Your payment QR' : 'No QR yet'}
          </Text>
          <Text color="secondary" style={styles.center}>
            {profile?.paymentQrPath
              ? 'Requesters use this to repay you after delivery.'
              : 'Add your QR so requesters can repay you after delivery.'}
          </Text>
        </View>
        {qrError ? (
          <Text variant="caption" color="error" style={styles.center}>
            {qrError}
          </Text>
        ) : null}
        {stagedQr ? (
          <View style={styles.staged}>
            <StagedFileCard
              file={stagedQr}
              title="Review your new QR"
              note="Tip: crop tightly around the code so it scans easily."
              busy={qrBusy}
              busyMessage={qrBusyMessage}
              confirmTitle={profile?.paymentQrPath ? 'Confirm & replace QR' : 'Confirm & set QR'}
              onConfirm={() => void handleQrConfirm()}
              onRechoose={() => void handleQrChoose()}
              onCancel={() => setStagedQr(null)}
            />
          </View>
        ) : !hasQr ? (
          <Button
            title={qrBusy ? (qrBusyMessage ?? 'Working…') : 'Upload QR'}
            onPress={() => void handleQrChoose()}
            disabled={qrBusy}
            loading={qrBusy}
          />
        ) : null}
        {managing ? (
          <View style={styles.manage}>
            {confirmingRemove ? (
              <View style={styles.confirm}>
                <Text color="secondary" style={styles.center}>
                  Remove this QR? Requesters will not be able to pay you until you add a new one.
                </Text>
                <Button
                  title={qrBusy ? 'Removing…' : 'Remove QR'}
                  variant="danger"
                  onPress={() => void handleQrRemove()}
                  disabled={qrBusy}
                  loading={qrBusy}
                />
                <Button title="Keep QR" variant="secondary" onPress={() => setConfirmingRemove(false)} disabled={qrBusy} />
              </View>
            ) : (
              <View style={styles.manageRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change payment QR"
                  accessibilityState={{ disabled: qrBusy }}
                  onPress={() => void handleQrChoose()}
                  disabled={qrBusy}
                  style={({ pressed }) => [styles.manageAction, pressed && styles.pressed]}>
                  <Text color={qrBusy ? 'muted' : 'secondary'}>Change</Text>
                </Pressable>
                <View style={styles.manageDivider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove payment QR"
                  accessibilityHint="Opens a confirmation. Nothing changes until you confirm."
                  accessibilityState={{ disabled: qrBusy }}
                  onPress={() => setConfirmingRemove(true)}
                  disabled={qrBusy}
                  style={({ pressed }) => [styles.manageAction, pressed && styles.pressed]}>
                  <Text color={qrBusy ? 'muted' : 'error'}>Remove</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
      </Screen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm, alignItems: 'center', paddingTop: spacing.md },
  center: { textAlign: 'center' },
  qrWrap: { width: '100%', maxWidth: 320, alignSelf: 'center' },
  emptyEmblem: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staged: { gap: spacing.sm },
  manage: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  manageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  manageAction: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  manageDivider: { width: 1, height: 20, backgroundColor: colors.border },
  confirm: { gap: spacing.sm },
  pressed: { opacity: 0.7 },
});
