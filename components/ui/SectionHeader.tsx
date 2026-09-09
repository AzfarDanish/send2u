import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  badge?: string;
  actionTitle?: string;
  onAction?: () => void;
}

/** Consistent section heading: optional eyebrow, title, badge, text action. */
export function SectionHeader({ eyebrow, title, badge, actionTitle, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        {eyebrow && (
          <Text variant="eyebrow" color="primary">
            {eyebrow.toUpperCase()}
          </Text>
        )}
        <Text variant="title">{title}</Text>
        {badge && <Badge label={badge} tone="info" />}
      </View>
      {actionTitle && onAction && (
        <Button title={actionTitle} variant="tertiary" onPress={onAction} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  textBlock: { flex: 1, gap: spacing.xs },
});
