import * as Clipboard from 'expo-clipboard';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';

interface CopyButtonProps {
  /** Exact text to copy — always the value shown on screen, never hidden data. */
  value: string;
  accessibilityLabel: string;
}

/**
 * Copy-to-clipboard action with inline "Copied" feedback. Silent no-op
 * where clipboard access is unavailable — copying must never block the
 * surrounding flow or surface a screen-level error.
 */
export function CopyButton({ value, accessibilityLabel }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (permissions, platform): stay quiet.
    }
  }, [value]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copied ? 'Copied' : accessibilityLabel}
      onPress={() => void handleCopy()}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <MaterialIcons
        name={copied ? 'check' : 'content-copy'}
        size={20}
        color={copied ? colors.success : colors.secondary}
      />
      {copied ? (
        <Text variant="caption" style={styles.copied}>
          Copied
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  copied: { color: colors.success, fontWeight: '600' },
});
