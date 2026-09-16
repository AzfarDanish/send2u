import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BrandHeader } from '@/components/BrandHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { OptionCard } from '@/components/ui/OptionCard';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/domain';

type Mode = 'sign-in' | 'sign-up';

/**
 * Production-style account entry: real email/password signup and login.
 * Signup requires exactly one role (Requester or Helper); the role is stored
 * once by the server at account creation and is permanent afterwards.
 * Navigation after entry is declarative — `(auth)/_layout` redirects
 * authenticated users to `/`, which routes by role.
 */
export default function SignInScreen() {
  const { user, isSupabaseEnabled, authError, signUp, signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('requester');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (user) {
    return <Redirect href="/" />;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setFormError(null);
    setConfirmationSent(false);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setConfirmationSent(false);
    try {
      if (mode === 'sign-up') {
        const result = await signUp(email, password, role);
        if (result.status === 'confirmation-required') {
          // No session exists yet: stay put and say so. Entering the app
          // here would bypass email verification.
          setConfirmationSent(true);
        }
      } else {
        await signIn(email, password);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BrandHeader />
      <SectionHeader
        eyebrow={mode === 'sign-up' ? 'Create account' : 'Welcome back'}
        title={mode === 'sign-up' ? 'Join Send2U' : 'Sign in to Send2U'}
      />

      {!isSupabaseEnabled && (
        <Card>
          <Badge label="Setup needed" tone="warning" />
          <Text variant="subtitle">Supabase not configured</Text>
          <Text color="secondary">
            Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable authentication.
          </Text>
        </Card>
      )}

      {authError && (
        <Card>
          <Badge label="Notice" tone="error" />
          <Text variant="subtitle">Session restore issue</Text>
          <Text color="secondary">{authError}</Text>
        </Card>
      )}

      {isSupabaseEnabled && (
        <>
          <Card>
            <Text variant="subtitle">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@campus.edu"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType={mode === 'sign-up' ? 'emailAddress' : 'username'}
              editable={!busy}
              style={styles.input}
              accessibilityLabel="Email address"
            />
            <Text variant="subtitle">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'sign-up' ? 'At least 6 characters' : 'Your password'}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
              editable={!busy}
              style={styles.input}
              accessibilityLabel="Password"
            />
          </Card>

          {mode === 'sign-up' && (
            <View style={styles.roleBlock}>
              <Text variant="subtitle">Choose your role — it is permanent</Text>
              <OptionCard
                icon="shopping-bag"
                title="I'm ordering food"
                selected={role === 'requester'}
                disabled={busy}
                onPress={() => setRole('requester')}
              />
              <OptionCard
                icon="delivery-dining"
                title="I'm helping & earning"
                selected={role === 'helper'}
                disabled={busy}
                onPress={() => setRole('helper')}
              />
            </View>
          )}

          {formError && (
            <Card>
              <ErrorState
                title={mode === 'sign-up' ? 'Could not create account' : 'Could not sign in'}
                message={formError}
              />
            </Card>
          )}

          {confirmationSent && (
            <Card>
              <Badge label="Check your inbox" tone="info" />
              <Text variant="subtitle">Confirm your email</Text>
              <Text color="secondary">
                Your account was created. Open the confirmation email, then come back and sign in.
              </Text>
            </Card>
          )}

          <Button
            title={busy ? 'Working…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
            onPress={() => void submit()}
            disabled={busy}
            loading={busy}
          />
          <Button
            title={mode === 'sign-up' ? 'Have an account? Sign in' : 'New here? Create an account'}
            variant="tertiary"
            onPress={() => switchMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
            disabled={busy}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  roleBlock: { gap: spacing.sm },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
