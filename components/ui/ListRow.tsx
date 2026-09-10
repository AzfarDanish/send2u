import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, radii, spacing, touchTargets } from '@/constants/theme';
import { Text } from '@/components/ui/Text';

interface ListRowProps extends Omit<PressableProps, 'style'> {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  /** Trailing content; defaults to a chevron when the row is pressable. */
  right?: React.ReactNode;
  showChevron?: boolean;
}

/**
 * Settings/menu-style row: tinted icon chip, title + subtitle, chevron.
 * Non-pressable when no `onPress` is given (chevron hidden by default then).
 */
export function ListRow({ icon, title, subtitle, right, showChevron, ...rest }: ListRowProps) {
  const pressable = typeof rest.onPress === 'function';
  const chevron = showChevron ?? pressable;
  return (
    <Pressable
      accessibilityRole={pressable ? 'button' : 'summary'}
      disabled={!pressable}
      style={({ pressed }) => [styles.row, pressed && pressable && styles.pressed]}
      {...rest}>
      <View style={styles.iconWrap}>
        <MaterialIcons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.textBlock}>
        <Text variant="secondary" style={styles.title}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" color="secondary">
            {subtitle}
          </Text>
        )}
      </View>
      {right}
      {chevron && <MaterialIcons name="chevron-right" size={24} color={colors.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTargets.listRow,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: spacing.xs },
  title: { fontWeight: '600', color: colors.text },
});
