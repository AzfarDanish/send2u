import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';

export type HistoryTab = 'active' | 'history';

interface ActiveHistoryToggleProps {
  tab: HistoryTab;
  onChange: (tab: HistoryTab) => void;
  activeLabel?: string;
  historyLabel?: string;
  historyCount?: number;
}

/**
 * Segmented Active / History switch used inside My Orders and My Deliveries.
 * Visual only — the actual separation lives in the service queries, so the
 * two tabs can never show the same order.
 */
export function ActiveHistoryToggle({
  tab,
  onChange,
  activeLabel = 'Active',
  historyLabel = 'History',
  historyCount,
}: ActiveHistoryToggleProps) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: tab === 'active' }}
        onPress={() => onChange('active')}
        style={({ pressed }) => [
          styles.segment,
          tab === 'active' && styles.selected,
          pressed && styles.pressed,
        ]}>
        <Text
          variant="secondary"
          style={[styles.label, tab === 'active' && styles.labelSelected]}>
          {activeLabel}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: tab === 'history' }}
        onPress={() => onChange('history')}
        style={({ pressed }) => [
          styles.segment,
          tab === 'history' && styles.selected,
          pressed && styles.pressed,
        ]}>
        <Text
          variant="secondary"
          style={[styles.label, tab === 'history' && styles.labelSelected]}>
          {typeof historyCount === 'number'
            ? `${historyLabel} · ${historyCount}`
            : historyLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  selected: { backgroundColor: colors.surface },
  pressed: { opacity: 0.7 },
  label: { fontWeight: '600', color: colors.secondary },
  labelSelected: { color: colors.primary },
});
