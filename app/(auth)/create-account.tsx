import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthField } from '@/components/auth/AuthField';
import { AuthLink } from '@/components/auth/AuthLink';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { updateMyProfile } from '@/services/auth';

interface CreateAccountErrors {
  fullName?: string;
  confirmPassword?: string;
}

export default function CreateAccountScreen() {
  const { user, isSupabaseEnabled, authError, signUp, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<CreateAccountErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (user) {
    return <Redirect href="/" />;
  }

  if (!isSupabaseEnabled) {
    return (
      <AuthScreen title="Create account" description="Join Send2U and get started">
        <Text variant="caption" color="error" accessibilityRole="alert">
          Authentication is not configured.
        </Text>
      </AuthScreen>
    );
  }

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/sign-in');
    }
  };

  const submit = async () => {
    if (busy) return;
    const trimmedName = fullName.trim();
    const nextErrors: CreateAccountErrors = {};
    if (trimmedName.length < 2) {
      nextErrors.fullName = 'Enter your full name (at least 2 characters).';
    } else if (trimmedName.length > 60) {
      nextErrors.fullName = 'Keep your name under 60 characters.';
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(nextErrors);
    setFormError(null);
    setConfirmationSent(false);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const result = await signUp(email, password, 'requester');
      if (result.status === 'confirmation-required') {
        setConfirmationSent(true);
        return;
      }
      try {
        const next = await updateMyProfile({
          fullName: trimmedName,
          studentId: result.profile.studentId,
          phoneNumber: result.profile.phoneNumber,
        });
        updateProfile(next);
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : 'Your account was created, but your name could not be saved yet.',
        );
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Create account"
      description="Join Send2U and get started"
      onBack={goBack}
      backLabel="Back to Sign In"
      footer={
        <View style={styles.footerRow}>
          <Text color="secondary">Already have an account? </Text>
          <AuthLink title="Sign In" onPress={() => router.replace('/(auth)/sign-in')} />
        </View>
      }>
      {authError ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {authError}
        </Text>
      ) : null}
      <AuthField
        icon="person-outline"
        value={fullName}
        onChangeText={(value) => {
          setFullName(value);
          setFieldErrors((previous) => ({ ...previous, fullName: undefined }));
        }}
        placeholder="Full name"
        accessibilityLabel="Full name"
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="name"
        editable={!busy}
        error={fieldErrors.fullName}
      />
      <AuthField
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        accessibilityLabel="Email address"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!busy}
      />
      <AuthField
        icon="lock-outline"
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        accessibilityLabel="Password"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        secureToggle
        textContentType="newPassword"
        editable={!busy}
      />
      <AuthField
        icon="lock-outline"
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          setFieldErrors((previous) => ({ ...previous, confirmPassword: undefined }));
        }}
        placeholder="Confirm password"
        accessibilityLabel="Confirm password"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        secureToggle
        textContentType="newPassword"
        editable={!busy}
        error={fieldErrors.confirmPassword}
      />
      <Button
        title={busy ? 'Working…' : 'Create Account'}
        onPress={() => void submit()}
        disabled={busy}
        loading={busy}
        style={styles.primaryButton}
      />
      {formError ? (
        <Text variant="caption" color="error" accessibilityRole="alert" style={styles.note}>
          {formError}
        </Text>
      ) : null}
      {confirmationSent ? (
        <Text color="secondary" style={styles.note}>
          Check your inbox to confirm your email, then sign in.
        </Text>
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  primaryButton: { minHeight: 56 },
  note: { marginTop: spacing.sm },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
