import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { PrivateImage } from '@/components/PrivateImage';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { setPaymentQrPath } from '@/services/auth';
import { pickPaymentImage, qrPathFor, removeObject, uploadObject } from '@/services/storage';

export default function HelperProfileScreen() {
  const { user, profile, devAuthEnabled, switchRole, signOut, refreshProfile } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const handleSwitch = async () => {
    setIsSwitching(true);
    try {
      // No manual navigation: the group layout redirects on role change.
      await switchRole('requester');
    } catch (error) {
      Alert.alert('Could not switch role', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleQrUpload = useCallback(async () => {
    if (!user || qrBusy) return;
    setQrBusy(true);
    setQrError(null);
    let uploadedPath: string | null = null;
    try {
      const picked = await pickPaymentImage();
      if (!picked) return;
      const previous = profile?.paymentQrPath ?? null;
      const path = qrPathFor(user.id, picked.extension);
      await uploadObject(path, picked);
      uploadedPath = path;
      await setPaymentQrPath(path);
      if (previous && previous !== path) {
        try {
          await removeObject(previous);
        } catch {
          // Stale QR file is harmless; the profile already points at the new one.
        }
      }
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
    }
  }, [user, qrBusy, profile?.paymentQrPath, refreshProfile]);

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
              ID {user?.id.slice(0, 8)}… · {user?.isAnonymous ? 'Test session' : user?.email ?? 'Signed in'}
            </Text>
          </View>
          <Badge label="Helper" tone="success" />
        </View>
        <Text variant="caption" color="muted">
          Student verification arrives with production sign-in.
        </Text>
      </Card>

      <Card>
        <ListRow
          icon="delivery-dining"
          title="My deliveries"
          subtitle="Active jobs and delivery history"
          onPress={() => router.push('/(helper)/deliveries')}
        />
        <ListRow
          icon="payments"
          title="Payouts"
          subtitle="Earnings summary — coming soon"
        />
      </Card>

      <Card>
        <View style={styles.qrHeader}>
          <Text variant="subtitle">Payment QR</Text>
          {profile?.paymentQrPath ? (
            <Badge label="Set" tone="success" />
          ) : (
            <Badge label="Not set" tone="warning" />
          )}
        </View>
        <Text color="secondary">
          Requesters pay you externally using this QR after you accept their order.
        </Text>
        {profile?.paymentQrPath ? (
          <PrivateImage path={profile.paymentQrPath} accessibilityLabel="Your payment QR code" />
        ) : (
          <Text variant="caption" color="muted">
            No QR yet — without one, requesters see payment as unavailable on your jobs.
          </Text>
        )}
        {qrError ? (
          <Text variant="caption" color="error">
            {qrError}
          </Text>
        ) : null}
        <Button
          title={qrBusy ? 'Working…' : profile?.paymentQrPath ? 'Replace QR' : 'Upload QR'}
          variant="secondary"
          onPress={() => void handleQrUpload()}
          disabled={qrBusy}
          loading={qrBusy}
        />
        {profile?.paymentQrPath ? (
          <Button
            title="Remove QR"
            variant="danger"
            onPress={() => void handleQrRemove()}
            disabled={qrBusy}
          />
        ) : null}
      </Card>

      {devAuthEnabled ? (
        <Card>
          <Badge label="Development" tone="warning" />
          <Text variant="subtitle">Preview the requester side</Text>
          <Text color="secondary">Switch roles instantly without signing in again.</Text>
          <Button
            title={isSwitching ? 'Switching…' : 'Switch to requester'}
            variant="secondary"
            onPress={handleSwitch}
            disabled={isSwitching}
            loading={isSwitching}
          />
        </Card>
      ) : null}

      <Button title="Sign out" variant="danger" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: 2 },
  qrHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
