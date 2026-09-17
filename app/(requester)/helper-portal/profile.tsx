import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { GlassHeader } from '@/components/GlassHeader';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

/**
 * Helper Portal profile: the helper's working identity. It is not an
 * account screen — sign-out and account settings live on the main
 * Profile. Payment QR management lives on its own screen.
 */
export default function HelperPortalProfileScreen() {
  const { user, profile } = useAuth();
  const displayName =
    profile?.fullName?.trim() || profile?.displayName?.trim() || user?.email?.split('@')[0] || 'Helper';

  return (
    <HelperPortalGuard title="Profile">
      <GlassHeader title="Profile" hideBack />
      <Screen beneathHeader underTabs>
        <View style={styles.header}>
          <Avatar name={displayName} path={profile?.avatarPath} size={72} />
          <Text variant="subtitle" numberOfLines={2} style={styles.name}>
            {displayName}
          </Text>
          {user?.email ? (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>

        <Card style={styles.section}>
          <ListRow
            icon="qr-code"
            title="Payment QR"
            subtitle="Requesters repay you through this code"
            onPress={() => router.push('/(requester)/helper-portal/payment-qr')}
          />
        </Card>

        <Text variant="caption" color="muted" style={styles.note}>
          Delivering as a verified Send2U helper. Your requester orders,
          settings, and sign-out stay on your main profile.
        </Text>

        <DevProfileSwitcher />
      </Screen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  name: { textAlign: 'center' },
  section: { gap: 0 },
  note: { textAlign: 'center' },
});
