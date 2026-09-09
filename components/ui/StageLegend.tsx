import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';

const STAGES = ['Requested', 'Assigned', 'On its way', 'Delivered', 'Confirmed'] as const;

/**
 * Static legend of the Send2U delivery lifecycle. Informational only —
 * it documents the stages every order moves through, not live state.
 */
export function StageLegend({ caption = 'Every order moves through these stages.' }: { caption?: string }) {
  return (
    <View style={styles.container} accessibilityRole="summary" accessibilityLabel={`Delivery stages: ${STAGES.join(', ')}`}>
      <View style={styles.track}>
        {STAGES.map((stage, index) => (
          <View key={stage} style={styles.step}>
            <View style={styles.dot}>
              <Text variant="caption" color="primary" style={styles.number}>
                {index + 1}
              </Text>
            </View>
            <Text variant="caption" color="secondary" style={styles.label}>
              {stage}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="caption" color="muted">
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  track: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  step: { flex: 1, alignItems: 'center', gap: spacing.xs },
  dot: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { fontWeight: '700' },
  label: { textAlign: 'center' },
});
