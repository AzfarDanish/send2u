import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';

/** Full-area loading state with an accessible label. */
export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text color="secondary">{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xxxl },
});
