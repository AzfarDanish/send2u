import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function HelperProfileScreen() {
  const { user, devAuthEnabled, switchRole, signOut } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);

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

      {devAuthEnabled && (
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
      )}

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
});
