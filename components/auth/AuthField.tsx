import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';

interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  icon: keyof typeof MaterialIcons.glyphMap;
  error?: string | null;
  secureToggle?: boolean;
}

/**
 * Minimal filled auth input: light-gray resting surface, no border, leading
 * icon, and an eye toggle for secrets. Inline caption errors only.
 */
export function AuthField({
  icon,
  error,
  secureToggle = false,
  secureTextEntry,
  editable = true,
  onFocus,
  onBlur,
  accessibilityLabel,
  ...rest
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const showToggle = secureToggle || secureTextEntry === true;
  const obscured = showToggle ? !revealed : (secureTextEntry ?? false);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.field,
          focused && styles.focused,
          error ? styles.invalid : null,
          editable === false && styles.readonly,
        ]}>
        <MaterialIcons name={icon} size={20} color={colors.muted} style={styles.icon} />
        <TextInput
          editable={editable}
          secureTextEntry={obscured}
          placeholderTextColor={colors.muted}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          accessibilityLabel={accessibilityLabel}
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
              size={20}
              color={colors.muted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {error}
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
    minHeight: 56,
    borderRadius: radii.md,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: spacing.lg,
  },
  focused: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  invalid: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  readonly: { backgroundColor: colors.surfaceSecondary },
  icon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    paddingVertical: spacing.lg,
    fontSize: 16,
    color: colors.text,
  },
  toggle: {
    width: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
