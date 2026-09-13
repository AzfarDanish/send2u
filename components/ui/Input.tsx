import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Field label rendered above the input. */
  label?: string;
  /** Helper or error text rendered below. `error` takes precedence. */
  hint?: string;
  /** Validation message; switches border + text to the error treatment. */
  error?: string | null;
  /** Character counter target (e.g. 500); shows `value.length/maxLength`. */
  counterMax?: number;
  /** Shows an eye toggle for password fields. */
  secureToggle?: boolean;
}

/**
 * Shared Send2U text input (design.md §5.8). Bordered resting state, brand
 * focus ring, inline error treatment, optional counter and secure toggle.
 * Per-screen adoption happens in later phases; no screen migrates here.
 */
export function Input({
  label,
  hint,
  error,
  counterMax,
  secureToggle = false,
  secureTextEntry,
  editable = true,
  maxLength,
  value,
  onFocus,
  onBlur,
  accessibilityLabel,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const showToggle = secureToggle || secureTextEntry === true;
  const obscured = showToggle ? !revealed : (secureTextEntry ?? false);
  const count = counterMax !== undefined ? (value ?? '').length : null;

  return (
    <View style={styles.container}>
      {label ? <Text variant="subtitle">{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && styles.focused,
          error ? styles.invalid : null,
          editable === false && styles.readonly,
        ]}>
        <TextInput
          value={value}
          maxLength={maxLength ?? counterMax}
          editable={editable}
          secureTextEntry={obscured}
          placeholderTextColor={colors.muted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={accessibilityLabel ?? label}
          style={styles.input}
          {...rest}
        />
        {showToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((open) => !open)}
            style={styles.toggle}
            hitSlop={8}>
            <MaterialIcons
              name={revealed ? 'visibility-off' : 'visibility'}
              size={22}
              color={colors.secondary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="secondary">
          {hint}
        </Text>
      ) : null}
      {count !== null && counterMax !== undefined ? (
        <Text variant="caption" color="muted">
          {count}/{counterMax}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.error },
  readonly: { backgroundColor: colors.surfaceSecondary },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
  },
  toggle: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: spacing.sm,
  },
});
