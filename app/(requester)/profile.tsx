import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { MainHeader } from '@/components/MainHeader';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { SkeletonProfile } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, touchTargets, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

const MENU_ROWS = [
  { icon: 'person-outline', title: 'Edit Profile', href: '/(requester)/edit-profile' },
  { icon: 'place', title: 'Saved Locations', href: '/(requester)/locations' },
  { icon: 'notifications-none', title: 'Notifications', href: '/(requester)/notifications' },
  { icon: 'help-outline', title: 'Help Center', href: '/(requester)/help' },
  { icon: 'description', title: 'Terms & Privacy', href: '/(requester)/terms' },
] as const;

export default function RequesterProfileScreen() {
  const { user, profile, isVerifiedHelper, signOut, isLoading } = useAuth();
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
      <MainHeader title="Profile" showSettings />
      {isLoading ? (
        // The avatar, name, and email all come from the session/profile rows:
        // placeholder personal data here would be wrong twice over.
        <SkeletonProfile rows={5} label="Loading your profile" />
      ) : (
        <>
          <View style={styles.header}>
            <Avatar name={displayName} path={profile?.avatarPath} size={72} />
            <Text variant="subtitle" style={styles.name} numberOfLines={2}>
              {displayName}
            </Text>
            {user?.email ? (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
          </View>

          <Card style={styles.section}>
            {MENU_ROWS.map((row) => (
              <ListRow
                key={row.href}
                icon={row.icon}
                title={row.title}
                onPress={() => router.push(row.href)}
              />
            ))}
          </Card>

          {isVerifiedHelper ? (
            <View style={styles.helperSection}>
              <Text variant="subtitle">Helper</Text>
              <Text variant="caption" color="secondary">
                Your delivery capability — queue, active jobs, and deliveries.
              </Text>
              <Card style={styles.section}>
                <ListRow
                  icon="delivery-dining"
                  title="Helper Portal"
                  subtitle="Available jobs and your deliveries"
                  onPress={() => router.push('/(requester)/helper-portal')}
                />
              </Card>
            </View>
          ) : null}
        </>
      )}

      <DevProfileSwitcher />

      {signOutError ? (
        <Card style={styles.section}>
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
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  name: { textAlign: 'center' },
  section: { gap: 0 },
  helperSection: { gap: spacing.xs },
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
