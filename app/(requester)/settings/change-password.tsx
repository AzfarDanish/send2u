import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { GlassHeader } from '@/components/GlassHeader';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { changePassword } from '@/services/auth';

interface PasswordErrors {
  current?: string;
  next?: string;
  confirm?: string;
}

/**
 * Real password change: verifies the current password by re-authenticating,
 * then rotates to the new one. Input is preserved on failure; success
 * shows a confirmation and steps back to Settings.
 */
export default function ChangePasswordScreen() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Hidden tab routes stay mounted: a revisit after success must show a
  // fresh form, never the stale confirmation.
  useFocusEffect(
    useCallback(() => {
      setCurrent('');
      setNext('');
      setConfirm('');
      setErrors({});
      setSaveError(null);
      setSaving(false);
      setDone(false);
    }, []),
  );

  async function handleSave(): Promise<void> {
    if (saving || done) return;
    const nextErrors: PasswordErrors = {};
    if (current.length === 0) nextErrors.current = 'Enter your current password.';
    if (next.length < 6) nextErrors.next = 'Use a password with at least 6 characters.';
    if (confirm !== next) nextErrors.confirm = 'Passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (err) {
      // Form input is preserved; only the error surfaces.
      setSaveError(err instanceof Error ? err.message : 'Could not change your password. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <>
        <GlassHeader title="Change Password" />
        <Screen beneathHeader>
        <Card>
          <Text variant="subtitle">Password changed</Text>
          <Text color="secondary">Use your new password the next time you sign in.</Text>
        </Section>
        <Button
          title="Done"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(requester)/settings');
            }
          }}
        />
        </Screen>
      </>
    );
  }

  return (
    <>
      <GlassHeader title="Change Password" />
      <Screen beneathHeader>
      <Input
        label="Current Password"
        value={current}
        onChangeText={(text) => {
          setCurrent(text);
          if (errors.current) setErrors((prev) => ({ ...prev, current: undefined }));
        }}
        error={errors.current}
        secureToggle
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="next"
      />
      <Input
        label="New Password"
        value={next}
        onChangeText={(text) => {
          setNext(text);
          if (errors.next) setErrors((prev) => ({ ...prev, next: undefined }));
        }}
        error={errors.next}
        hint="At least 6 characters."
        secureToggle
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="next"
      />
      <Input
        label="Confirm New Password"
        value={confirm}
        onChangeText={(text) => {
          setConfirm(text);
          if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: undefined }));
        }}
        error={errors.confirm}
        secureToggle
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={() => void handleSave()}
      />
      {saveError ? (
        <Card>
          <ErrorState
            title="Could not change password"
            message={saveError}
            retryTitle="Dismiss"
            onRetry={() => setSaveError(null)}
          />
        </Section>
      ) : null}
      <Button
        title={saving ? 'Saving…' : 'Save Changes'}
        loading={saving}
        disabled={saving}
        onPress={() => void handleSave()}
      />
      </Screen>
    </>
  );
}
