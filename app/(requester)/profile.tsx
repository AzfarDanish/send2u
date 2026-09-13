import { StyleSheet, View } from 'react-native';
import { useState } from 'react';

import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';

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

  const displayName = profile?.displayName ?? user?.email ?? null;
  const initial = (displayName?.trim().charAt(0) ?? '?').toUpperCase();

  return (
    <Screen underTabs>
      <SectionHeader eyebrow="Profile" title="Your account" />
      <Card>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text variant="title" style={styles.initial}>
              {initial}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text variant="subtitle">{profile?.displayName ?? 'Campus requester'}</Text>
            <Text variant="caption" color="secondary">
              {user?.email ?? 'Signed in'}
            </Text>
          </View>
          <Badge label="Requester" tone="primary" />
        </View>
      </Card>

      <Card style={styles.menuCard}>
        <ListRow
          icon="receipt-long"
          title="My Requests"
          onPress={() => router.push('/(requester)/orders')}
        />
        <ListRow
          icon="place"
          title="Saved Drop-off Locations"
          onPress={() => router.push('/(requester)/locations')}
        />
        <ListRow
          icon="notifications-none"
          title="Notifications"
          onPress={() => router.push('/(requester)/notifications')}
        />
        <ListRow
          icon="help-outline"
          title="Help Center"
          onPress={() => router.push('/(requester)/help')}
        />
        <ListRow
          icon="report-problem"
          title="Report an Issue"
          onPress={() => router.push('/(requester)/report')}
        />
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
      <Button
        title={signingOut ? 'Signing out…' : 'Sign out'}
        variant="danger"
        style={styles.signOut}
        onPress={() => void handleSignOut()}
        disabled={signingOut}
        loading={signingOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: colors.onPrimary },
  identityText: { flex: 1, gap: spacing.xs },
  menuCard: { gap: 0 },
  signOut: { backgroundColor: colors.errorSoft },
});
