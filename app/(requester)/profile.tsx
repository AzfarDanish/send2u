import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
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
import { router } from 'expo-router';

export default function RequesterProfileScreen() {
  const { user, devAuthEnabled, switchRole, signOut } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitch = async () => {
    setIsSwitching(true);
    try {
      // No manual navigation: the group layout redirects on role change.
      await switchRole('helper');
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
            <MaterialIcons name="person" size={28} color={colors.primary} />
          </View>
          <View style={styles.identityText}>
            <Text variant="subtitle">Campus requester</Text>
            <Text variant="caption" color="secondary">
              ID {user?.id.slice(0, 8)}… · {user?.isAnonymous ? 'Test session' : user?.email ?? 'Signed in'}
            </Text>
          </View>
          <Badge label="Requester" tone="primary" />
        </View>
      </Card>

      <Card>
        <ListRow
          icon="receipt-long"
          title="My orders"
          subtitle="Track deliveries and order history"
          onPress={() => router.push('/(requester)/orders')}
        />
        <ListRow
          icon="location-on"
          title="Saved drop-off points"
          subtitle="Hostel, faculty, library — coming soon"
        />
      </Card>

      {devAuthEnabled && (
        <Card>
          <Badge label="Development" tone="warning" />
          <Text variant="subtitle">Preview the helper side</Text>
          <Text color="secondary">Switch roles instantly without signing in again.</Text>
          <Button
            title={isSwitching ? 'Switching…' : 'Switch to helper'}
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
