import { GlassHeader } from '@/components/GlassHeader';
import { Section } from '@/components/ui/Section';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import type { LegalSection } from '@/lib/legal-content';

/** Scrollable legal document: glass title + section cards. Shared by Terms/Privacy. */
export function LegalDocument({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <>
      <GlassHeader title={title} />
      <Screen beneathHeader>
        {sections.map((section) => (
          <Section key={section.heading}>
            <Text variant="subtitle">{section.heading}</Text>
            {section.body.map((paragraph, index) => (
              <Text key={index} color="secondary">
                {paragraph}
              </Text>
            ))}
          </Section>
        ))}
      </Screen>
    </>
  );
}
