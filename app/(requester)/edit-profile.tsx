import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { SkeletonForm } from '@/components/ui/LoadingBlocks';
import { GlassHeader } from '@/components/GlassHeader';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { setAvatarPath, updateMyProfile } from '@/services/auth';
import {
  avatarPathFor,
  pickAvatarImage,
  removeObject,
  uploadObject,
  type PickedImage,
} from '@/services/storage';

interface FormErrors {
  fullName?: string;
  studentId?: string;
  phoneNumber?: string;
}

/**
 * Malaysian mobile numbers: +60 1X-XXX XXXX, 60 1X-XXX XXXX, or 01X-XXX
 * XXXX. Separators are ignored; the cleaned value is stored.
 * Returns `undefined` for empty (field is optional), `null` for invalid.
 */
function normalizeMyPhone(raw: string): string | null | undefined {
  const cleaned = raw.replace(/[\s\-()]/g, '');
  if (cleaned.length === 0) return undefined;
  const match = /^(?:\+?60|0)(1\d{8,9})$/.exec(cleaned);
  return match ? `+60${match[1]}` : null;
}

function validate(fullName: string, studentId: string, phoneNumber: string): FormErrors {
  const errors: FormErrors = {};
  if (fullName.trim().length < 2) {
    errors.fullName = 'Enter your full name (at least 2 characters).';
  } else if (fullName.trim().length > 60) {
    errors.fullName = 'Keep your name under 60 characters.';
  }
  const id = studentId.trim();
  if (id.length > 0 && !/^[A-Za-z0-9-]{3,20}$/.test(id)) {
    errors.studentId = 'Use 3–20 letters or numbers.';
  }
  if (normalizeMyPhone(phoneNumber) === null) {
    errors.phoneNumber = 'Enter a valid Malaysian mobile number, e.g. +60 12-345 6789.';
  }
  return errors;
}

export default function EditProfileScreen() {
  const { user, profile, updateProfile, isLoading } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName ?? profile?.displayName ?? '');
  const [studentId, setStudentId] = useState(profile?.studentId ?? '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber ?? '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [preview, setPreview] = useState<PickedImage | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Hidden tab routes stay mounted: re-sync the form with shared profile
  // state every time the screen is shown, so a revisit never shows stale
  // values after a save or an external change. Runs only on focus gain,
  // never while the user is typing.
  // `profile` only changes identity on explicit updates (save, avatar),
  // never while typing — safe to re-sync from it on focus.
  const profileSnapshot = profile;
  useFocusEffect(
    useCallback(() => {
      setFullName(profileSnapshot?.fullName ?? profileSnapshot?.displayName ?? '');
      setStudentId(profileSnapshot?.studentId ?? '');
      setPhoneNumber(profileSnapshot?.phoneNumber ?? '');
      setErrors({});
      setSaveError(null);
      setSaving(false);
      setPreview(null);
      setPhotoError(null);
    }, [profileSnapshot]),
  );

  const displayName =
    fullName.trim() || profile?.fullName?.trim() || profile?.displayName?.trim() || 'You';

  async function handlePhoto(): Promise<void> {
    if (uploadingPhoto || !user) return;
    setPhotoError(null);
    let picked: PickedImage | null;
    try {
      picked = await pickAvatarImage();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not open your photos.');
      return;
    }
    if (!picked) return; // User cancelled.
    setPreview(picked);
    setUploadingPhoto(true);
    const previous = profile?.avatarPath ?? null;
    let removedPrevious = false;
    let uploadedPath: string | null = null;
    let pointerUpdated = false;
    try {
      // Replace means remove-first: the old object goes before the new one
      // is saved, so a change never leaves two live photos behind.
      if (previous) {
        try {
          await removeObject(previous);
        } catch {
          throw new Error('Could not remove the old photo. Nothing was changed. Try again.');
        }
        removedPrevious = true;
      }
      const path = avatarPathFor(user.id, picked.extension);
      try {
        await uploadObject(path, picked);
      } catch {
        throw new Error(
          removedPrevious
            ? 'The old photo was removed but the new upload failed. Tap to try again.'
            : 'Could not upload your photo. Try again.',
        );
      }
      uploadedPath = path;
      let next;
      try {
        next = await setAvatarPath(path);
      } catch {
        throw new Error(
          removedPrevious
            ? 'The old photo was removed but the new one could not be saved. Tap to try again.'
            : 'Could not update your photo. Try again.',
        );
      }
      pointerUpdated = true;
      updateProfile(next);
      setPreview(null);
    } catch (err) {
      if (uploadedPath && !pointerUpdated) {
        try {
          await removeObject(uploadedPath);
        } catch {
          // Orphaned upload without a pointer; retrying the change covers it.
        }
      }
      if (removedPrevious && !pointerUpdated) {
        // The profile may still reference the deleted file: clear it so the
        // UI falls back to initials instead of a broken image.
        try {
          await setAvatarPath(null);
        } catch {
          // Reported below; retrying the change clears it.
        }
      }
      setPreview(null);
      setPhotoError(err instanceof Error ? err.message : 'Could not update your photo. Try again.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (saving) return;
    const nextErrors = validate(fullName, studentId, phoneNumber);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    setSaveError(null);
    const normalizedPhone = normalizeMyPhone(phoneNumber);
    try {
      const next = await updateMyProfile({
        fullName: fullName.trim(),
        studentId: studentId.trim().length > 0 ? studentId.trim() : null,
        // Validated above: `undefined` (empty) clears, otherwise a +60… value.
        phoneNumber: normalizedPhone ?? null,
      });
      // Shared state patches in place — Profile already shows the new
      // values when we step back. No refetch, no form reset needed.
      // Deep links have no history to pop, so fall back to Profile.
      updateProfile(next);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(requester)/profile');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your changes. Try again.');
      setSaving(false);
    }
  }

  // The form is prefilled from the profile row and re-syncs on focus, so
  // rendering it before identity resolves would hand the user empty fields
  // that mutate under them. Replace the whole form with the placeholder.
  if (isLoading) {
    return (
      <>
        <GlassHeader title="Edit Profile" />
        <Screen beneathHeader>
          <SkeletonForm fields={4} label="Loading your profile" />
        </Screen>
      </>
    );
  }

  return (
    <>
      <GlassHeader title="Edit Profile" />
      <Screen beneathHeader>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change profile photo"
        onPress={() => void handlePhoto()}
        disabled={uploadingPhoto}
        style={({ pressed }) => [styles.photoWrap, pressed && styles.pressed]}>
        <Avatar
          name={displayName}
          path={profile?.avatarPath}
          previewUri={preview?.uri}
          size={96}
        />
        <View style={styles.cameraBadge} pointerEvents="none">
          {uploadingPhoto ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="photo-camera" size={18} color={colors.primary} />
          )}
        </View>
      </Pressable>
      <Text variant="secondary" color="secondary" style={styles.photoHint}>
        Tap to change photo
      </Text>
      {photoError ? (
        <Text variant="caption" color="error" accessibilityRole="alert" style={styles.centered}>
          {photoError}
        </Text>
      ) : null}

      <Input
        label="Full Name"
        value={fullName}
        onChangeText={(text) => {
          setFullName(text);
          if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
        }}
        error={errors.fullName}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={60}
        returnKeyType="next"
      />
      <Input label="Email" value={user?.email ?? ''} editable={false} hint="Your email identifies your account and can't be changed." />
      <Input
        label="Student ID (optional)"
        value={studentId}
        onChangeText={(text) => {
          setStudentId(text);
          if (errors.studentId) setErrors((prev) => ({ ...prev, studentId: undefined }));
        }}
        error={errors.studentId}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={20}
        returnKeyType="next"
      />
      <Input
        label="Phone Number (optional)"
        value={phoneNumber}
        onChangeText={(text) => {
          setPhoneNumber(text);
          if (errors.phoneNumber) setErrors((prev) => ({ ...prev, phoneNumber: undefined }));
        }}
        error={errors.phoneNumber}
        hint="Malaysian mobile, e.g. +60 12-345 6789."
        keyboardType="phone-pad"
        autoCorrect={false}
        maxLength={16}
        returnKeyType="done"
        onSubmitEditing={() => void handleSave()}
      />

      {saveError ? (
        <Card>
          <ErrorState
            title="Could not save changes"
            message={saveError}
            retryTitle="Dismiss"
            onRetry={() => setSaveError(null)}
          />
        </Card>
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

const styles = StyleSheet.create({
  photoWrap: { alignSelf: 'center', marginTop: spacing.md },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: { textAlign: 'center' },
  centered: { textAlign: 'center' },
  pressed: { opacity: 0.8 },
});
