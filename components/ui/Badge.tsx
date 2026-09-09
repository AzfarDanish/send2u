import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/constants/theme';
import { Text } from '@/components/ui/Text';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

const toneStyles: Record<BadgeTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: colors.disabledBackground, color: colors.secondary },
  primary: { backgroundColor: colors.primarySoft, color: colors.primary },
  success: { backgroundColor: colors.successSoft, color: colors.success },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning },
  error: { backgroundColor: colors.errorSoft, color: colors.error },
  info: { backgroundColor: colors.infoSoft, color: colors.info },
};

/** Small status pill. Always pairs color with a text label (never color-only). */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const toneStyle = toneStyles[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.backgroundColor }]}>
      <Text style={[styles.label, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  label: { ...typography.caption, fontWeight: '600' },
});
