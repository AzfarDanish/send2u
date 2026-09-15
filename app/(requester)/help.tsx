import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { colors } from '@/constants/theme';
import { HELP_ARTICLES } from '@/lib/help-content';

/**
 * Help Center: searchable article list over real Send2U flows.
 * Search filters in place — the screen never reloads and input keeps focus.
 */
export default function HelpCenterScreen() {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return HELP_ARTICLES;
    return HELP_ARTICLES.filter(
      (article) =>
        article.title.toLowerCase().includes(needle) ||
        article.description.toLowerCase().includes(needle) ||
        article.body.some((paragraph) => paragraph.toLowerCase().includes(needle)),
    );
  }, [query]);

  return (
    <>
      <GlassHeader title="Help Center" />
      <Screen beneathHeader>
        <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search for help..."
        accessibilityLabel="Search help articles"
      />
      {visible.length === 0 ? (
        <EmptyState
          icon="search-off"
          title="No results"
          message={`Nothing about “${query.trim()}”. Try different words.`}
        />
      ) : (
        <Card style={styles.listCard}>
          {visible.map((article, index) => (
            <View key={article.id} style={index < visible.length - 1 && styles.divider}>
              <ListRow
                icon={article.icon}
                title={article.title}
                subtitle={article.description}
                accessibilityLabel={`${article.title}. ${article.description}`}
                onPress={() =>
                  router.push({ pathname: '/(requester)/help/[id]', params: { id: article.id } })
                }
              />
            </View>
          ))}
        </Card>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  listCard: { gap: 0 },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
});
