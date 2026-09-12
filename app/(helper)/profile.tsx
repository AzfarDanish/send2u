import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { PrivateImage } from '@/components/PrivateImage';
import { StagedFileCard } from '@/components/StagedFileCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { setPaymentQrPath } from '@/services/auth';
import {
  displayFileName,
  pickPaymentImage,
  qrPathFor,
  removeObject,
  uploadObject,
  type PickedImage,
} from '@/services/storage';

export default function HelperProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [qrBusy, setQrBusy] = useState(false);
  const [qrBusyMessage, setQrBusyMessage] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  // Picked-but-not-uploaded QR awaiting explicit confirmation. Nothing
  // reaches Storage or the profile until the user confirms.
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
    <Screen>
      <SectionHeader eyebrow="Profile" title="Your account" />
      <Card>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <MaterialIcons name="delivery-dining" size={28} color={colors.primary} />
          </View>
          <View style={styles.identityText}>
            <Text variant="subtitle">Student helper</Text>
            <Text variant="caption" color="secondary">
              {user?.email ?? 'Signed in'} · ID {user?.id.slice(0, 8)}…
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <ListRow
          icon="delivery-dining"
          title="My deliveries"
          onPress={() => router.push('/(helper)/deliveries')}
        />
        <ListRow
          icon="payments"
          title="Payouts"
          onPress={() => router.push('/(helper)/earnings')}
        />
      </Card>

      <Card>
        <Text variant="subtitle">Payment QR</Text>
        <Text variant="caption" color="muted">
          {profile?.paymentQrPath ? 'QR set' : 'No QR set'}
        </Text>
        {profile?.paymentQrPath ? (
          <>
            <PrivateImage path={profile.paymentQrPath} accessibilityLabel="Your payment QR code" />
            <Text variant="caption" color="muted">
              {displayFileName(profile.paymentQrPath)}
            </Text>
          </>
        ) : (
          <Text variant="caption" color="muted">
            Requesters can&apos;t pay you without one.
          </Text>
        )}
        {qrError ? (
          <Text variant="caption" color="error">
            {qrError}
          </Text>
        ) : null}
        {stagedQr ? (
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
        ) : (
          <Button
            title={qrBusy ? (qrBusyMessage ?? 'Working…') : profile?.paymentQrPath ? 'Replace QR' : 'Upload QR'}
            variant="secondary"
            onPress={() => void handleQrChoose()}
            disabled={qrBusy}
            loading={qrBusy}
          />
        )}
        {profile?.paymentQrPath ? (
          <Button
            title="Remove QR"
            variant="danger"
            onPress={() => void handleQrRemove()}
            disabled={qrBusy || stagedQr !== null}
          />
        ) : null}
      </Card>

      <DevProfileSwitcher />

      <Button title="Sign out" variant="danger" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: spacing.xs },
});
