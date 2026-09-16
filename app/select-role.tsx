import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { OptionCard } from '@/components/ui/OptionCard';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/domain';

/**
 * Account recovery, NOT role selection: reachable only when a signed-in
 * account has no usable role. That means either the profile row is missing
 * (accounts created before automatic profile setup) — repaired here with a
 * strictly one-time INSERT that throws when a row already exists — or the
 * account carries a role the app does not serve. There is deliberately no
 * control here that changes an existing role.
 */
export default function SelectRoleScreen() {
  const { user, profile, role, isLoading, claimMissingProfile, refreshProfile, signOut } = useAuth();
  const [selected, setSelected] = useState<UserRole>('requester');
  const [busy, setBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Wait for session restore before deciding: redirecting on `!user` while
  // still loading would bounce authenticated users through sign-in.
  if (isLoading) {
    return (
      <Screen>
        <LoadingState message="Loading your account…" />
      </Screen>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (role) {
    return <Redirect href="/" />;
  }

  const retry = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : 'Could not reload your account.');
    } finally {
      setRefreshing(false);
    }
  };

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    setClaimError(null);
    try {
      await claimMissingProfile(selected);
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : 'Could not finish setup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SectionHeader eyebrow="Setup" title="Finish setting up your account" />
      {profile ? (
        <Card>
          <ErrorState
            title="Unsupported account role"
            message="This account carries a role this app does not serve. Sign out and use a requester or vendor account."
          />
        </Card>
      ) : (
        <>
          <Card>
            <Text color="secondary">
              This account joins as a requester. Helper access is granted separately.
            </Text>
          </Card>
          <View style={styles.roleBlock}>
            <OptionCard
              icon="shopping-bag"
              title="Requester"
              selected={selected === 'requester'}
              disabled={busy}
              onPress={() => setSelected('requester')}
            />
          </View>
          {claimError && (
            <Card>
              <ErrorState title="Could not finish setup" message={claimError} />
            </Card>
          )}
          <Button
            title={busy ? 'Saving…' : 'Confirm role (permanent)'}
            onPress={() => void claim()}
            disabled={busy}
            loading={busy}
          />
          <Button
            title={refreshing ? 'Checking…' : 'My profile should exist — check again'}
            variant="secondary"
            onPress={() => void retry()}
            disabled={busy || refreshing}
            loading={refreshing}
          />
        </>
      )}
      <Button title="Sign out" variant="tertiary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  roleBlock: { gap: spacing.sm },
});
