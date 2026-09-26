import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { HeaderBell } from '@/components/HeaderBell';
import { HeaderSettings } from '@/components/HeaderSettings';
import { RedScreen } from '@/components/RedScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { SkeletonProfile } from '@/components/ui/LoadingBlocks';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, touchTargets, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

/**
 * Settings-style destinations that actually exist. Helper is deliberately not
 * in this list: it is a capability of this same app, presented on its own
 * above. "Payment methods" and an About page do not exist, so no rows pretend
 * they do.
 */
const MENU_ROWS = [
  { icon: 'person-outline', title: 'Personal information', href: '/(requester)/edit-profile' },
  { icon: 'history', title: 'Past orders', href: '/(requester)/orders/past' },
  { icon: 'place', title: 'Saved locations', href: '/(requester)/set-location' },
  { icon: 'notifications-none', title: 'Notifications', href: '/(requester)/notifications' },
  { icon: 'help-outline', title: 'Help & Support', href: '/(requester)/help' },
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
    <RedScreen
      title="Profile"
      // Two header controls only: the bell (which must stay reachable from
      // every primary page) and the gear, both in on-primary white.
      right={
        <>
          <HeaderBell role="requester" color={colors.onPrimary} dotColor={colors.surface} />
          <HeaderSettings href="/(requester)/settings" color={colors.onPrimary} />
        </>
      }
      underTabs
      contentStyle={styles.content}>
      {isLoading ? (
        // The avatar, name, and email all come from the session/profile rows:
        // placeholder personal data here would be wrong twice over.
        <SkeletonProfile rows={5} label="Loading your profile" />
      ) : (
        <>
          {/* Identity sits against the header/white transition with no
              container around it, so the row itself reads as the control.
              Name and email are the real profile and session values. */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Profile details for ${displayName}. Opens personal information.`}
            haptic="selection"
            style={styles.identity}
            onPress={() => router.push('/(requester)/edit-profile')}>
            <Avatar name={displayName} path={profile?.avatarPath} size={64} />
            <View style={styles.identityText}>
              <Text variant="subtitle" numberOfLines={2}>
                {displayName}
              </Text>
              {user?.email ? (
                <Text variant="caption" color="secondary" numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
          </PressableScale>

          <View>
            {isVerifiedHelper ? (
              <ListRow
                icon="delivery-dining"
                title="Helper portal"
                subtitle="Available jobs, your deliveries, and cash collection."
                accessibilityLabel="Helper portal. Available jobs, your deliveries, and cash collection."
                onPress={() => router.push('/(requester)/helper-portal')}
              />
            ) : (
              // Helper access is granted by the Send2U team out of band, and no
              // self-serve application exists. So this stays a plain
              // informational row (no chevron, no action) rather than pointing
              // at a flow the backend cannot honour.
              <ListRow
                icon="delivery-dining"
                title="Be a helper"
                subtitle="Earn by delivering orders around campus. Helper access is granted by the Send2U team."
                accessibilityLabel="Be a helper. Earn by delivering orders around campus. Helper access is granted by the Send2U team."
              />
            )}
          </View>

          <View>
            {MENU_ROWS.map((row, index) => (
              <View
                key={row.href}
                style={index < MENU_ROWS.length - 1 ? styles.divider : undefined}>
                <ListRow
                  icon={row.icon}
                  title={row.title}
                  accessibilityLabel={row.title}
                  onPress={() => router.push(row.href)}
                />
              </View>
            ))}
          </View>
        </>
      )}

      {/* Dev tooling stays where it was, below the production rows: real test
          accounts read from the database, never hidden and never rebuilt. */}
      <DevProfileSwitcher />

      {signOutError ? (
        <ErrorState
          title="Could not sign out"
          message={signOutError}
          retryTitle="Dismiss"
          onRetry={() => setSignOutError(null)}
        />
      ) : null}

      {/* Outside the settings group and visually quiet: log out is available,
          never the loudest thing on the screen. */}
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
    </RedScreen>
  );
}

const styles = StyleSheet.create({
  // No top padding: the identity row starts at the sheet's first pixel, which
  // puts it directly against the red-to-white transition.
  content: { paddingTop: 0, gap: spacing.xxl },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTargets.listRow,
    paddingVertical: spacing.lg,
  },
  identityText: { flex: 1, gap: spacing.xs },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
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
