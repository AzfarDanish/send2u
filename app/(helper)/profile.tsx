import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { DownloadableQR } from '@/components/DownloadableQR';
import { StagedFileCard } from '@/components/StagedFileCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { setPaymentQrPath } from '@/services/auth';
import {
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
    <Screen underTabs>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <MaterialIcons name="delivery-dining" size={28} color={colors.primary} />
        </View>
        <Text variant="subtitle">Student helper</Text>
        {user?.email && (
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {user.email}
          </Text>
        )}
      </View>

      <Card style={styles.section}>
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

      <Card style={styles.section}>
        <Text variant="subtitle">Payment QR</Text>
        {profile?.paymentQrPath ? (
          <DownloadableQR
            path={profile.paymentQrPath}
            accessibilityLabel="Your payment QR code"
          />
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
  header: { 
    alignItems: 'center', 
    gap: spacing.sm, 
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  section: { gap: 0 },
});
