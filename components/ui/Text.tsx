import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { colors, typography, type ColorName, type TextVariant } from '@/constants/theme';

interface DSTextProps extends TextProps {
  variant?: TextVariant;
  color?: ColorName | string;
}

/** Send2U text primitive. Light-only; color defaults to `text`. */
export function Text({ variant = 'body', color = 'text', style, ...rest }: DSTextProps) {
  const resolved = (colors as Record<string, string>)[color] ?? color;
  return <RNText style={[styles.base, typography[variant], { color: resolved }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: { color: colors.text },
});
