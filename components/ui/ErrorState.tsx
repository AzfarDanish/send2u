import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

interface ErrorStateProps {
  title?: string;
  message: string;
  retryTitle?: string;
  onRetry?: () => void;
}

/** Friendly failure state: icon, message, optional retry action. */
export function ErrorState({ title = 'Something went wrong', message, retryTitle, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <MaterialIcons name="error-outline" size={32} color={colors.error} />
      </View>
      <Text variant="subtitle">{title}</Text>
      <Text color="secondary" style={styles.message}>
        {message}
      </Text>
      {retryTitle && onRetry && <Button title={retryTitle} variant="secondary" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: colors.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  message: { textAlign: 'center' },
});
