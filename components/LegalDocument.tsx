import { StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import type { LegalSection } from '@/lib/legal-content';

/** Scrollable legal document: title + section cards. Shared by Terms/Privacy. */
export function LegalDocument({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <Screen>
      <Text variant="title" style={styles.title}>
        {title}
      </Text>
      {sections.map((section) => (
        <Card key={section.heading}>
          <Text variant="subtitle">{section.heading}</Text>
          {section.body.map((paragraph, index) => (
            <Text key={index} color="secondary">
              {paragraph}
            </Text>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text },
});
