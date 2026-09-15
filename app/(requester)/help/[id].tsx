import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { getHelpArticle } from '@/lib/help-content';

/** Single help article. Back returns to the list with its search intact. */
export default function HelpArticleScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const article = typeof id === 'string' ? getHelpArticle(id) : undefined;

  if (!article) {
    return (
      <Screen>
        <EmptyState
          icon="help-outline"
          title="Article not found"
          message="This help topic doesn't exist."
          actionTitle="Back to Help Center"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title" style={styles.title}>
        {article.title}
      </Text>
      <Card>
        {article.body.map((paragraph, index) => (
          <Text key={index} color="secondary">
            {paragraph}
          </Text>
        ))}
      </Card>
      {article.action ? (
        <Button
          title={article.action.label}
          variant="secondary"
          onPress={() => router.push(article.action!.href)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text },
});
