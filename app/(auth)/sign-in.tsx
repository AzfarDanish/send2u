import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthField } from '@/components/auth/AuthField';
import { AuthLink } from '@/components/auth/AuthLink';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function SignInScreen() {
  const { user, isSupabaseEnabled, authError, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (user) {
    return <Redirect href="/" />;
  }

  if (!isSupabaseEnabled) {
    return (
      <AuthScreen title="Sign in" description="Continue to your Send2U account">
        <Text variant="caption" color="error" accessibilityRole="alert">
          Authentication is not configured.
        </Text>
      </AuthScreen>
    );
  }

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title="Sign in"
      description="Continue to your Send2U account"
      footer={
        <View style={styles.footerRow}>
          <Text color="secondary">Don&apos;t have an account? </Text>
          <AuthLink title="Create Account" onPress={() => router.push('/(auth)/create-account')} />
        </View>
      }>
      {authError ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {authError}
        </Text>
      ) : null}
      <AuthField
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        accessibilityLabel="Email address"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
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
        textContentType="password"
        editable={!busy}
      />
      <AuthLink
        title="Forgot password?"
        align="right"
        onPress={() => router.push('/(auth)/forgot-password')}
      />
      <Button
        title={busy ? 'Working…' : 'Sign In'}
        onPress={() => void submit()}
        disabled={busy}
        loading={busy}
        style={styles.primaryButton}
      />
      {formError ? (
        <Text variant="caption" color="error" accessibilityRole="alert" style={styles.formError}>
          {formError}
        </Text>
      ) : null}
      <View style={styles.divider} accessibilityElementsHidden>
        <View style={styles.dividerLine} />
        <Text variant="caption" color="muted" style={styles.dividerText}>
          or
        </Text>
        <View style={styles.dividerLine} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  primaryButton: { minHeight: 56 },
  formError: { marginTop: spacing.sm },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  dividerText: { marginHorizontal: spacing.md },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
