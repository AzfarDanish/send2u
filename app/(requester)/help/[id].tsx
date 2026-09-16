import { router, useLocalSearchParams } from 'expo-router';

import { GlassHeader } from '@/components/GlassHeader';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { getHelpArticle } from '@/lib/help-content';

/** Single help article. Back returns to the list with its search intact. */
export default function HelpArticleScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const article = typeof id === 'string' ? getHelpArticle(id) : undefined;

  if (!article) {
    return (
      <>
        <GlassHeader title="Help Center" />
        <Screen beneathHeader>
          <EmptyState
            icon="help-outline"
            title="Article not found"
            message="This help topic doesn't exist."
            actionTitle="Back to Help Center"
            onAction={() => router.back()}
          />
        </Screen>
      </>
    );
  }

  return (
    <>
      <GlassHeader title={article.title} />
      <Screen beneathHeader>
        <Card>
          {article.body.map((paragraph, index) => (
            <Text key={index} color="secondary">
              {paragraph}
            </Text>
          ))}
        </Section>
        {article.action ? (
          <Button
            title={article.action.label}
            variant="secondary"
            onPress={() => router.push(article.action!.href)}
          />
        ) : null}
      </Screen>
    </>
  );
}
