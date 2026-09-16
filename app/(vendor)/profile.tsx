import { StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { GlassHeader } from '@/components/GlassHeader';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMyVendor } from '@/hooks/useMyVendor';

/**
 * Vendor Profile tab: who is signed in and which stall is linked.
 * Stall editing lives on the Stall tab; menu editing on the Menu tab.
 * Vendor accounts never see orders, payments, or other stalls.
 */
export default function VendorProfileScreen() {
  const { user, signOut } = useAuth();
  const { vendor } = useMyVendor();

  return (
    <>
      <GlassHeader title="Profile" />
      <Screen beneathHeader underTabs>
        <SectionHeader eyebrow="Profile" title="Your account" />
      <Card>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <MaterialIcons name="storefront" size={28} color={colors.primary} />
          </View>
          <View style={styles.identityText}>
            <Text variant="subtitle">{vendor?.name ?? 'Stall operator'}</Text>
            <Text variant="caption" color="secondary">
              {user?.email ?? 'Signed in'} · ID {user?.id.slice(0, 8)}…
            </Text>
          </View>
        </View>
        <Text variant="caption" color="muted">
          Vendor is permanent on this account — roles never change.
        </Text>
      </Section>

      <DevProfileSwitcher />

      <Button title="Sign out" variant="danger" onPress={signOut} />
      </Screen>
    </>
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
