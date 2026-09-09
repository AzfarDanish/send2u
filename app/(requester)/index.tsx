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
import { colors } from '@/constants/theme';
import { useMenu } from '@/hooks/useMenu';
import type { MenuItemWithVendor } from '@/types/domain';

const HOW_IT_WORKS = [
  { icon: 'receipt-long', title: 'Request in seconds', subtitle: 'Pick your meal and drop-off point on campus.' },
  { icon: 'delivery-dining', title: 'A helper picks it up', subtitle: 'A verified student collects it from the vendor.' },
  { icon: 'check-circle-outline', title: 'Delivered & confirmed', subtitle: 'Handed to you and confirmed in the app.' },
] as const;

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
        <Text color="secondary">Your current delivery will show up here with live status.</Text>
        <ListRow
          icon="add-circle-outline"
          title="Start a request"
          subtitle="Browse the menu and order in under a minute"
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
          message="The campus vendors haven't published anything yet. Pull down to check again."
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

      <SectionHeader title="How Send2U works" />
      <Card>
        {HOW_IT_WORKS.map((step) => (
          <ListRow key={step.title} icon={step.icon} title={step.title} subtitle={step.subtitle} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  vendorSection: { gap: 8 },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vendorText: { flex: 1, gap: 2 },
  itemsCard: { gap: 0 },
});
