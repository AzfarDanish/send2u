import { StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMyVendor } from '@/hooks/useMyVendor';

export default function VendorProfileScreen() {
  const { user, signOut } = useAuth();
  const { vendor } = useMyVendor();

  return (
    <Screen underTabs>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <MaterialIcons name="storefront" size={28} color={colors.primary} />
        </View>
        <Text variant="subtitle">{vendor?.name ?? 'Stall operator'}</Text>
        {user?.email && (
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {user.email}
          </Text>
        )}
      </View>

      <Card style={styles.section}>
        <Text variant="caption" color="muted">
          Vendor is permanent on this account — roles never change.
        </Text>
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
