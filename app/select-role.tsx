import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { RoleSelect } from '@/components/RoleSelect';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/domain';

/**
 * Shown when a session exists but no app role is set (e.g. profile row
 * missing). Writes the chosen role to `send2u_profiles`, then routes.
 */
export default function SelectRoleScreen() {
  const { user, role, isLoading, devAuthEnabled, switchRole, signOut } = useAuth();
  const [busyRole, setBusyRole] = useState<UserRole | null>(null);

  // Wait for session restore before deciding: redirecting on `!user` while
  // still loading would bounce authenticated users through sign-in.
  if (isLoading) {
    return (
      <Screen>
        <LoadingState message="Loading your role…" />
      </Screen>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const choose = async (next: UserRole) => {
    if (!devAuthEnabled) {
      Alert.alert('Role selection unavailable', 'Development auth is disabled in this build.');
      return;
    }
    setBusyRole(next);
    try {
      await switchRole(next);
      router.replace(next === 'helper' ? '/(helper)' : '/(requester)');
    } catch (error) {
      Alert.alert('Could not set role', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusyRole(null);
    }
  };

  return (
    <Screen>
      <SectionHeader eyebrow="Setup" title="Choose your experience" />
      <RoleSelect onSelect={choose} busyRole={busyRole} currentRole={role} disabled={!devAuthEnabled} />
      <Button title="Sign out" variant="tertiary" onPress={signOut} />
    </Screen>
  );
}
