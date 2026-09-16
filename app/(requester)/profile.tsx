import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, touchTargets, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

const MENU_ROWS = [
  // `as const` at the end keeps icon glyphs and route literals narrow.
  { icon: 'person-outline', title: 'Edit Profile', href: '/(requester)/edit-profile', accessibilityLabel: 'Edit profile' },
  { icon: 'place', title: 'Saved Locations', href: '/(requester)/locations', accessibilityLabel: 'Saved locations' },
  { icon: 'notifications-none', title: 'Notifications', href: '/(requester)/notifications', accessibilityLabel: 'Notifications' },
  { icon: 'help-outline', title: 'Help Center', href: '/(requester)/help', accessibilityLabel: 'Help center' },
  { icon: 'description', title: 'Terms & Privacy', href: '/(requester)/terms', accessibilityLabel: 'Terms and privacy' },
] as const;

function roleLabel(role: string | null | undefined): string {
  if (role === 'helper') return 'Helper';
  if (role === 'vendor') return 'Vendor';
  return 'Requester';
}

export default function RequesterProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut(): Promise<void> {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch {
      setSignOutError('Could not sign you out. Check your connection and try again.');
      setSigningOut(false);
    }
  }

  const displayName =
    profile?.fullName?.trim() || profile?.displayName?.trim() || 'Campus requester';

  return (
    <Screen underTabs>
      <View style={styles.header}>
        <Avatar name={displayName} path={profile?.avatarPath} size={96} />
        <Text variant="subtitle" style={styles.name} numberOfLines={2}>
          {displayName}
        </Text>
        {user?.email ? (
          <Text variant="secondary" color="secondary" numberOfLines={1} ellipsizeMode="middle">
            {user.email}
          </Text>
        ) : null}
        <View style={styles.pillWrap}>
          <Badge label={roleLabel(profile?.role)} tone="primary" />
        </View>
      </View>

      <Card style={styles.menuCard}>
        {MENU_ROWS.map((row, index) => (
          <View key={row.href} style={index < MENU_ROWS.length - 1 && styles.divider}>
            <ListRow
              icon={row.icon}
              title={row.title}
              accessibilityLabel={row.accessibilityLabel}
              onPress={() => router.push(row.href)}
            />
          </View>
        ))}
      </Card>

      <DevProfileSwitcher />

      {signOutError ? (
        <Card>
          <ErrorState
            title="Could not sign out"
            message={signOutError}
            retryTitle="Dismiss"
            onRetry={() => setSignOutError(null)}
          />
        </Card>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log out"
        accessibilityState={{ disabled: signingOut, busy: signingOut }}
        disabled={signingOut}
        onPress={() => void handleSignOut()}
        style={({ pressed }) => [styles.logOut, pressed && !signingOut && styles.pressed]}>
        <MaterialIcons name="logout" size={20} color={colors.primary} />
        <Text variant="button" style={styles.logOutLabel}>
          {signingOut ? 'Signing out…' : 'Log Out'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  pillWrap: { alignItems: 'center' },
  name: { color: colors.text, textAlign: 'center' },
  menuCard: { gap: 0 },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  logOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: touchTargets.button,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  logOutLabel: { color: colors.primary, ...typography.button },
  pressed: { opacity: 0.7 },
});
