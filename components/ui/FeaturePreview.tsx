import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';

interface FeaturePreviewProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
  bullets?: string[];
}

/**
 * Intentional product-style placeholder for not-yet-built features.
 * Clearly labeled "Coming soon" — never pretends the feature works.
 */
export function FeaturePreview({ icon, title, description, bullets = [] }: FeaturePreviewProps) {
  return (
    <Card>
      <View style={styles.heading}>
        <MaterialIcons name={icon} size={22} color={colors.primary} />
        <Text variant="subtitle">{title}</Text>
      </View>
      <Text color="secondary">{description}</Text>
      {bullets.map((bullet) => (
        <View key={bullet} style={styles.bullet}>
          <MaterialIcons name="check-circle-outline" size={16} color={colors.muted} />
          <Text variant="secondary" color="secondary" style={styles.bulletText}>
            {bullet}
          </Text>
        </View>
      ))}
      <Badge label="Coming soon" tone="info" />
    </Section>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bulletText: { flex: 1, lineHeight: 20 },
});
