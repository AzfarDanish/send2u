import { router } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { MenuItemRow } from '@/components/MenuItemRow';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useMenu } from '@/hooks/useMenu';
import { useMyOrders } from '@/hooks/useMyOrders';
import { formatMYR } from '@/lib/money';
import {
  orderItemsTitle,
  orderStatusTone,
  orderTotalCents,
  requesterStatusMessage,
} from '@/lib/orders';
import type { MenuItemWithVendor } from '@/types/domain';

export default function RequesterHomeScreen() {
  const { sections, itemCount, status, error, refreshing, retry, refresh } = useMenu();
  const {
    orders,
    status: ordersStatus,
    refreshing: ordersRefreshing,
    refresh: refreshOrders,
  } = useMyOrders();
  const { count, subtotalCents } = useCart();

  const openItem = useCallback((item: MenuItemWithVendor) => {
    router.push({ pathname: '/(requester)/menu/[id]', params: { id: item.id } });
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), refreshOrders()]);
  }, [refresh, refreshOrders]);

  // `listMyOrders` returns active orders only, newest first.
  const preview = orders.length > 0 ? orders[0] : null;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing || ordersRefreshing}
          onRefresh={() => void refreshAll()}
          tintColor={colors.primary}
        />
      }>
      <SectionHeader eyebrow="Today on campus" title="Good food, carried by students" />

      {ordersStatus === 'loading' ? (
        <Card style={styles.previewLoading}>
          <LoadingState message="Checking your requests…" />
        </Card>
      ) : null}
      {/* On orders error the menu below stays fully usable; no preview shown. */}
      {ordersStatus === 'ready' || ordersStatus === 'empty' ? (
        preview ? (
          <Card>
            <Badge label={requesterStatusMessage(preview.status)} tone={orderStatusTone(preview.status)} />
            <Text variant="subtitle">{orderItemsTitle(preview.items)}</Text>
            <Text variant="caption" color="secondary">
              {preview.vendor.name} · {formatMYR(orderTotalCents(preview.subtotalCents, preview.deliveryFeeCents))}
            </Text>
            <Button
              title="View request"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/(requester)/orders/[id]', params: { id: preview.id } })
              }
            />
            {orders.length > 1 ? (
              <Button
                title={`View all ${orders.length} active requests`}
                variant="tertiary"
                onPress={() => router.push('/(requester)/orders')}
              />
            ) : null}
          </Card>
        ) : (
          <Card>
            <Badge label="No active requests" tone="neutral" />
            <Text variant="subtitle">No active requests</Text>
            <Text color="secondary">Your current requests will appear here.</Text>
            <ListRow
              icon="add-circle-outline"
              title="Start a request"
              onPress={() => router.push('/(requester)/create')}
            />
          </Card>
        )
      ) : null}

      {count > 0 ? (
        <Card>
          <ListRow
            icon="shopping-cart"
            title={`Cart · ${count} item${count === 1 ? '' : 's'}`}
            subtitle={formatMYR(subtotalCents)}
            onPress={() => router.push('/(requester)/create')}
          />
        </Card>
      ) : null}

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
                  {section.vendor.operatingHours ? (
                    <Text variant="caption" color="secondary">
                      {section.vendor.operatingHours}
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
  previewLoading: { minHeight: 120, justifyContent: 'center' },
  vendorSection: { gap: spacing.md },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vendorText: { flex: 1, gap: spacing.xs },
  itemsCard: { gap: 0 },
});
