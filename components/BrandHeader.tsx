import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';

interface BrandHeaderProps {
  /** Short supporting line under the product name. */
  tagline?: string;
}

/** Send2U brand lockup: logo mark, name, tagline. */
export function BrandHeader({ tagline = 'Student-powered campus delivery' }: BrandHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <MaterialIcons name="send" size={26} color={colors.onPrimary} />
      </View>
      <Text variant="display">Send2U</Text>
      <Text color="secondary">{tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  logo: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
