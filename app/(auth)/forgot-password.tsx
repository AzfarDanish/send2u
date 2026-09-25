import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthField } from '@/components/auth/AuthField';
import { AuthLink } from '@/components/auth/AuthLink';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function ForgotPasswordScreen() {
  const { user, isSupabaseEnabled, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  if (user) {
    return <Redirect href="/" />;
  }

  if (!isSupabaseEnabled) {
    return (
      <AuthScreen
        title="Forgot password?"
        description="Enter your email and we'll send you a link to reset your password.">
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

  const submit = () => {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email address.');
      setUnavailable(false);
      return;
    }
    setError(null);
    setUnavailable(true);
  };

  return (
    <AuthScreen
      title="Forgot password?"
      description="Enter your email and we'll send you a link to reset your password."
      onBack={goBack}
      backLabel="Back to Sign In"
      footer={<AuthLink title="Back to Sign In" onPress={() => router.replace('/(auth)/sign-in')} />}>
      {authError ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {authError}
        </Text>
      ) : null}
      <AuthField
        icon="mail-outline"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setError(null);
          setUnavailable(false);
        }}
        placeholder="Email"
        accessibilityLabel="Email address"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        error={error}
      />
      <Button title="Send Reset Link" onPress={submit} style={styles.primaryButton} />
      {unavailable ? (
        <Text color="secondary" accessibilityRole="alert" style={styles.note}>
          Password reset is not available in this build yet.
        </Text>
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  primaryButton: { minHeight: 56 },
  note: { marginTop: spacing.sm },
});
