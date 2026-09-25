import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, radii, spacing } from '@/constants/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  /** Pill variant: fully rounded, borderless, no shadow (e.g. on the red home header). */
  pill?: boolean;
}

/**
 * Shared client-side search matching for the requester discovery screens.
 * Case-insensitive substring match over any of the given text fields;
 * an empty query matches everything so cleared searches restore full lists.
 *
 * Lives here (not `lib/`) because `lib/` is gitignored — see `.gitignore`.
 */
export function matchesSearch(query: string, ...fields: readonly (string | null | undefined)[]): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  return fields.some((field) => (field ?? '').toLowerCase().includes(needle));
}

/**
 * Minimalist single-line search field shared by Home and Vendor pages:
 * icon, input, and a clear button only while text exists. White surface
 * with a hairline border — no card, no shadow.
 */
export function SearchBar({ value, onChangeText, placeholder, accessibilityLabel, pill = false }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, pill && styles.pill, focused && !pill && styles.focused]}>
      <MaterialIcons name="search" size={22} color={colors.secondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="search"
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          hitSlop={8}>
          <MaterialIcons name="close" size={20} color={colors.secondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.primary },
  pill: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 0,
    borderRadius: radii.full,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.text,
  },
  clear: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
