import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DownloadableQR } from '@/components/DownloadableQR';
import { GlassHeader } from '@/components/GlassHeader';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { StagedFileCard } from '@/components/StagedFileCard';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
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
    setQrBusyMessage('Uploading QR…');
    setQrError(null);
    let uploadedPath: string | null = null;
    try {
      const previous = profile?.paymentQrPath ?? null;
      const path = qrPathFor(user.id, stagedQr.extension, stagedQr.name);
      await uploadObject(path, stagedQr);
      uploadedPath = path;
      await setPaymentQrPath(path);
      if (previous && previous !== path) {
        try {
          await removeObject(previous);
        } catch {
          // Stale QR file is harmless; the profile already points at the new one.
        }
      }
      setStagedQr(null);
      await refreshProfile();
    } catch (error) {
      if (uploadedPath) {
        try {
          await removeObject(uploadedPath);
        } catch {
          // Orphaned upload is harmless; the profile was never updated.
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
      await refreshProfile();
    } catch (error) {
      setQrError(error instanceof Error ? error.message : 'Could not remove the QR code.');
    } finally {
      setQrBusy(false);
    }
  }, [user, qrBusy, profile?.paymentQrPath, refreshProfile]);

  return (
    <HelperPortalGuard title="Payment QR">
      <GlassHeader title="Payment QR" fallbackHref="/(requester)/helper-portal/profile" />
      <Screen beneathHeader>
        <Text variant="subtitle">Your payment QR</Text>
        <Text color="secondary">Requesters use this to repay you after delivery.</Text>
        {profile?.paymentQrPath ? (
          <View style={styles.qrWrap}>
            <DownloadableQR path={profile.paymentQrPath} accessibilityLabel="Your payment QR code" />
          </View>
        ) : (
          <Text variant="caption" color="muted">
            No QR set yet. Requesters cannot pay you without one.
          </Text>
        )}
        {qrError ? (
          <Text variant="caption" color="error">
            {qrError}
          </Text>
        ) : null}
        {stagedQr ? (
          <View style={styles.staged}>
            <StagedFileCard
              file={stagedQr}
              title="Review your new QR"
              busy={qrBusy}
              busyMessage={qrBusyMessage}
              confirmTitle={profile?.paymentQrPath ? 'Confirm & replace QR' : 'Confirm & set QR'}
              onConfirm={() => void handleQrConfirm()}
              onRechoose={() => void handleQrChoose()}
              onCancel={() => setStagedQr(null)}
            />
          </View>
        ) : (
          <Button
            title={qrBusy ? (qrBusyMessage ?? 'Working…') : profile?.paymentQrPath ? 'Change QR' : 'Upload QR'}
            variant="secondary"
            onPress={() => void handleQrChoose()}
            disabled={qrBusy}
            loading={qrBusy}
          />
        )}
        {profile?.paymentQrPath && !stagedQr ? (
          <Button
            title="Remove QR"
            variant="danger"
            onPress={() => void handleQrRemove()}
            disabled={qrBusy}
          />
        ) : null}
      </Screen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  staged: { gap: spacing.sm },
  qrWrap: { maxWidth: 320 },
});
