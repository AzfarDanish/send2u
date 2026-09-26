import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { SkeletonHero } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMyVendor } from '@/hooks/useMyVendor';

export default function VendorProfileScreen() {
  const { user, signOut, isLoading } = useAuth();
  const { vendor, status } = useMyVendor();
  // The pin is the stall's own coordinate, absent until the vendor places it, so
  // the row states which of those two facts is true rather than implying one.
  const hasPin =
    typeof vendor?.pickupLat === 'number' && typeof vendor?.pickupLng === 'number';

  return (
    <Screen underTabs>
      {isLoading || status === 'loading' ? (
        // Stall name and account email both arrive with the row — hold the
        // header's geometry rather than flashing the fallback name.
        <SkeletonHero label="Loading your stall profile" />
      ) : (
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
      )}

      <Card style={styles.section}>
        <ListRow
          icon="my-location"
          title={hasPin ? 'Pickup pin' : 'Set your pickup pin'}
          subtitle={
            hasPin
              ? 'Helpers are routed to this point. You can move it if the stall moves.'
              : 'Not set yet — until it is, helpers cannot be routed to your stall.'
          }
          accessibilityLabel={
            hasPin
              ? 'Pickup pin, set. Opens the map to move it.'
              : 'Pickup pin not set. Opens the map to place it.'
          }
          onPress={() => router.push('/(vendor)/pickup-pin')}
        />
      </Card>

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
