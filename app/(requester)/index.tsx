import { router } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { MenuItemRow } from '@/components/MenuItemRow';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useMenu } from '@/hooks/useMenu';
import type { MenuItemWithVendor } from '@/types/domain';

export default function RequesterHomeScreen() {
  const { sections, itemCount, status, error, refreshing, retry, refresh } = useMenu();

  const openItem = useCallback((item: MenuItemWithVendor) => {
    router.push({ pathname: '/(requester)/menu/[id]', params: { id: item.id } });
  }, []);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }>
      <SectionHeader eyebrow="Today on campus" title="Good food, carried by students" />

      <Card>
        <Badge label="No active order" tone="neutral" />
        <Text variant="subtitle">Nothing on the way</Text>
        <ListRow
          icon="add-circle-outline"
          title="Start a request"
          onPress={() => router.push('/(requester)/create')}
        />
      </Card>

      <SectionHeader
        title="Today's menu"
        badge={status === 'ready' ? `${itemCount} items` : undefined}
      />
      {status === 'loading' ? (
        <Card style={styles.stateCard}>
          <LoadingState message="Loading today's menu…" />
        </Card>
      ) : null}
      {status === 'error' ? (
        <Card style={styles.stateCard}>
          <ErrorState
            title="Couldn't load the menu"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        </Card>
      ) : null}
      {status === 'empty' ? (
        <EmptyState
          icon="storefront"
          title="No menu today"
          message="Pull down to check again."
        />
      ) : null}
      {status === 'ready'
        ? sections.map((section) => (
            <View key={section.vendor.id} style={styles.vendorSection}>
              <View style={styles.vendorHeader}>
                <View style={styles.vendorText}>
                  <Text variant="subtitle">{section.vendor.name}</Text>
                  {section.vendor.locationHint ? (
                    <Text variant="caption" color="secondary">
                      {section.vendor.locationHint}
                    </Text>
                  ) : null}
                </View>
                {!section.vendor.isOpen ? <Badge label="Closed" tone="warning" /> : null}
              </View>
              <Card style={styles.itemsCard}>
                {section.items.map((item) => (
                  <MenuItemRow key={item.id} item={item} onPress={openItem} />
                ))}
              </Card>
            </View>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  vendorSection: { gap: spacing.md },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vendorText: { flex: 1, gap: spacing.xs },
  itemsCard: { gap: 0 },
});
