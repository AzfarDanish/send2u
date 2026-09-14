import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';

export type StatusCardTone = 'info' | 'success' | 'warning' | 'error';

const toneSurface: Record<StatusCardTone, string> = {
  info: colors.infoSoft,
  success: colors.successSoft,
  warning: colors.warningSoft,
  error: colors.errorSoft,
};

const toneAccent: Record<StatusCardTone, string> = {
  info: colors.info,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
};

/**
 * Contextual status card: tinted surface, leading icon chip, title, and a
 * plain-language description of what the status means and what happens
 * next. Copy always comes from the caller (per-status content), so the
 * card never hardcodes one message for every request.
 */
export function RequestStatusCard({
  tone,
  icon,
  title,
  description,
}: {
  tone: StatusCardTone;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: toneSurface[tone] }]}>
      <View style={[styles.iconChip, { backgroundColor: colors.surface }]}>
        <MaterialIcons name={icon} size={28} color={toneAccent[tone]} />
      </View>
      <View style={styles.textBlock}>
        <Text variant="subtitle" style={{ color: toneAccent[tone] }}>
          {title}
        </Text>
        <Text color="secondary">{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  iconChip: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: spacing.xs },
});
