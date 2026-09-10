import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/constants/theme';
import { Text } from '@/components/ui/Text';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

const toneStyles: Record<BadgeTone, { backgroundColor: string; color: string; borderColor: string }> = {
  neutral: { backgroundColor: colors.disabledBackground, color: colors.secondary, borderColor: colors.border },
  primary: { backgroundColor: colors.primarySoft, color: colors.primary, borderColor: colors.primarySoft },
  success: { backgroundColor: colors.successSoft, color: colors.success, borderColor: colors.successSoft },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning, borderColor: colors.warningSoft },
  error: { backgroundColor: colors.errorSoft, color: colors.error, borderColor: colors.errorSoft },
  info: { backgroundColor: colors.infoSoft, color: colors.info, borderColor: colors.infoSoft },
};

/** Small status pill. Always pairs color with a text label (never color-only). */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const toneStyle = toneStyles[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: toneStyle.backgroundColor, borderColor: toneStyle.borderColor },
      ]}>
      <Text style={[styles.label, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  label: { ...typography.caption, fontWeight: '600' },
});
