import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ActiveHistoryToggle, type HistoryTab } from '@/components/ActiveHistoryToggle';
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
import { useMyOrderHistory } from '@/hooks/useMyOrderHistory';
import { useMyOrders } from '@/hooks/useMyOrders';
import { formatMYR } from '@/lib/money';
import {
  formatOrderDate,
  orderItemsTitle,
  orderStatusTone,
  orderTotalCents,
  requesterStatusMessage,
} from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

export default function RequesterOrdersScreen() {
  const [tab, setTab] = useState<HistoryTab>('active');
  const active = useMyOrders();
  // History loads only when visible — except when Active is empty, where the
  // count decides the empty-state copy ("No active orders" vs "No orders yet").
  const history = useMyOrderHistory(tab === 'history' || active.status === 'empty');

  const openOrder = useCallback((order: OrderWithDetails) => {
    router.push({ pathname: '/(requester)/orders/[id]', params: { id: order.id } });
  }, []);

  const refreshing = active.refreshing || (tab === 'history' && history.refreshing);
  const handleRefresh = useCallback(async () => {
    // Refresh the visible list; the hidden one loads (or reloads) on visit.
    await Promise.all([active.refresh(), tab === 'history' ? history.refresh() : Promise.resolve()]);
  }, [active, history, tab]);

  return (
    <Screen
      underTabs
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
      }>
      <SectionHeader eyebrow="Requests" title="Your requests" />
      <ActiveHistoryToggle tab={tab} onChange={setTab} historyCount={history.orders.length} />
      {tab === 'active' ? (
        <>
          {active.status === 'loading' ? (
            <Card style={styles.stateCard}>
              <LoadingState message="Loading your orders…" />
            </Card>
          ) : null}
          {active.status === 'error' ? (
            <Card style={styles.stateCard}>
              <ErrorState
                title="Couldn't load orders"
                message={active.error ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={active.retry}
              />
            </Card>
          ) : null}
          {active.status === 'empty' ? (
            <EmptyState
              icon="receipt-long"
              title={history.orders.length > 0 ? 'No active orders' : 'No orders yet'}
              message={
                history.orders.length > 0
                  ? 'Past orders live in History.'
                  : 'New orders appear here.'
              }
              actionTitle="Browse menu"
              onAction={() => router.push('/(requester)')}
            />
          ) : null}
          {active.status === 'ready'
            ? active.orders.map((order) => (
                <Card key={order.id} style={styles.orderCard}>
                  <ListRow
                    icon="receipt-long"
                    title={order.vendor.name}
                    subtitle={`#${order.id.slice(0, 8)} · ${orderItemsTitle(order.items)} · ${order.location.name}`}
                    onPress={() => openOrder(order)}
                    right={
                      <View style={styles.right}>
                        <Badge label={requesterStatusMessage(order.status)} tone={orderStatusTone(order.status)} />
                        <Text variant="secondary" style={styles.subtotal}>
                          {formatMYR(orderTotalCents(order.subtotalCents, order.deliveryFeeCents))}
                        </Text>
                      </View>
                    }
                  />
                </Card>
              ))
            : null}
        </>
      ) : (
        <>
          {history.status === 'loading' ? (
            <Card style={styles.stateCard}>
              <LoadingState message="Loading your history…" />
            </Card>
          ) : null}
          {history.status === 'error' ? (
            <Card style={styles.stateCard}>
              <ErrorState
                title="Couldn't load history"
                message={history.error ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={history.retry}
              />
            </Card>
          ) : null}
          {history.status === 'empty' ? (
            <EmptyState
              icon="history"
              title="No history yet"
              message="Completed and cancelled orders appear here."
            />
          ) : null}
          {history.status === 'ready'
            ? history.orders.map((order) => (
                <Card key={order.id} style={styles.orderCard}>
                  <ListRow
                    icon="history"
                    title={order.vendor.name}
                    subtitle={`#${order.id.slice(0, 8)} · ${formatOrderDate(order.createdAt)} · ${order.location.name}`}
                    onPress={() => openOrder(order)}
                    right={
                      <View style={styles.right}>
                        <Badge label={requesterStatusMessage(order.status)} tone={orderStatusTone(order.status)} />
                        <Text variant="secondary" style={styles.subtotal}>
                          {formatMYR(orderTotalCents(order.subtotalCents, order.deliveryFeeCents))}
                        </Text>
                      </View>
                    }
                  />
                </Card>
              ))
            : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  orderCard: { gap: 0 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  subtotal: { fontWeight: '700', color: colors.primary },
});
