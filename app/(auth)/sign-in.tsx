import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BrandHeader } from '@/components/BrandHeader';
import { RoleSelect } from '@/components/RoleSelect';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/domain';

/**
 * Development entry screen. No credentials: each choice creates (or reuses)
 * a real anonymous Supabase session and stores the role in `send2u_profiles`.
 * Navigation after entry is declarative — `(auth)/_layout` redirects
 * authenticated users to `/`, which routes by role.
 */
export default function SignInScreen() {
  const { user, isSupabaseEnabled, devAuthEnabled, authError, continueAs } = useAuth();
  const [busyRole, setBusyRole] = useState<UserRole | null>(null);

  if (user) {
    return <Redirect href="/" />;
  }

  const enter = async (role: UserRole) => {
    setBusyRole(role);
    try {
      await continueAs(role);
    } catch (error) {
      Alert.alert(
        'Could not enter Send2U',
        error instanceof Error ? error.message : 'Authentication failed.',
      );
    } finally {
      setBusyRole(null);
    }
  };

  return (
    <Screen>
      <BrandHeader />
      <SectionHeader eyebrow="Get started" title="How will you use Send2U today?" />

      {!isSupabaseEnabled && (
        <Card>
          <Badge label="Setup needed" tone="warning" />
          <Text variant="subtitle">Supabase not configured</Text>
          <Text color="secondary">
            Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable authentication.
          </Text>
        </Card>
      )}

      {isSupabaseEnabled && !devAuthEnabled && (
        <Card>
          <Badge label="Unavailable" tone="neutral" />
          <Text variant="subtitle">Sign-in unavailable</Text>
          <Text color="secondary">Production sign-in is not configured yet in this build.</Text>
        </Card>
      )}

      {authError && (
        <Card>
          <Badge label="Notice" tone="error" />
          <Text variant="subtitle">Session restore issue</Text>
          <Text color="secondary">{authError}</Text>
        </Card>
      )}

      {isSupabaseEnabled && devAuthEnabled && (
        <>
          <RoleSelect onSelect={enter} busyRole={busyRole} />
          <View style={styles.devNote}>
            <MaterialIcons name="info-outline" size={16} color={colors.muted} />
            <Text variant="caption" color="muted" style={styles.devNoteText}>
              Development build · creates an anonymous test session, no credentials needed.
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  devNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
  devNoteText: { flex: 1 },
});
