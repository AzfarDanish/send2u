import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Minimum value; decrement below it is disabled. Defaults to 1. */
  min?: number;
  max?: number;
}

/** Local quantity stepper (− value +). State stays with the caller. */
export function QuantityStepper({ value, onChange, min = 1, max = 99 }: QuantityStepperProps) {
  return (
    <View style={styles.container}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        haptic="selection"
        hitSlop={8}
        style={[styles.stepper, value <= min && styles.disabled]}>
        <MaterialIcons name="remove" size={20} color={value <= min ? colors.disabled : colors.primary} />
      </PressableScale>
      <Text variant="subtitle" style={styles.value} accessibilityRole="text">
        {value}
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        haptic="selection"
        hitSlop={8}
        style={[styles.stepper, value >= max && styles.disabled]}>
        <MaterialIcons name="add" size={20} color={value >= max ? colors.disabled : colors.primary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepper: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    borderColor: colors.disabledBackground,
    backgroundColor: colors.surfaceSecondary,
  },
  value: { minWidth: 32, textAlign: 'center' },
});
