import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';

interface OptionCardProps extends Omit<PressableProps, 'style'> {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description?: string;
  selected?: boolean;
  loading?: boolean;
}

/** Large tappable choice row (role picker, request type, etc.). Flat layout with clear selection state. */
export function OptionCard({ icon, title, description, selected = false, loading = false, ...rest }: OptionCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, busy: loading }}
      style={({ pressed }) => [
        styles.card,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
      {...rest}>
      <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
        <MaterialIcons name={icon} size={26} color={selected ? colors.onPrimary : colors.primary} />
      </View>
      <View style={styles.textBlock}>
        <Text variant="subtitle">{title}</Text>
        {description ? (
          <Text variant="secondary" color="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <MaterialIcons
        name={loading ? 'hourglass-empty' : 'chevron-right'}
        size={24}
        color={selected ? colors.primary : colors.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  selected: { backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: { backgroundColor: colors.primary },
  textBlock: { flex: 1, gap: spacing.xs },
});
