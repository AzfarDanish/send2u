import { StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';

export default function RequesterProfileScreen() {
  const { user, signOut } = useAuth();

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
              {user?.email ?? 'Signed in'} · ID {user?.id.slice(0, 8)}…
            </Text>
          </View>
          <Badge label="Requester" tone="primary" />
        </View>
      </Card>

      <Card>
        <ListRow
          icon="receipt-long"
          title="My orders"
          onPress={() => router.push('/(requester)/orders')}
        />
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
