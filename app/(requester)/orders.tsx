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
import { StageLegend } from '@/components/ui/StageLegend';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useMyOrderHistory } from '@/hooks/useMyOrderHistory';
import { useMyOrders } from '@/hooks/useMyOrders';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, orderStatusLabel, orderStatusTone } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

export default function RequesterOrdersScreen() {
  const [tab, setTab] = useState<HistoryTab>('active');
  const active = useMyOrders();
  const history = useMyOrderHistory();

  const openOrder = useCallback((order: OrderWithDetails) => {
    router.push({ pathname: '/(requester)/orders/[id]', params: { id: order.id } });
  }, []);

  const refreshing = active.refreshing || history.refreshing;
  const handleRefresh = useCallback(async () => {
    await Promise.all([active.refresh(), history.refresh()]);
  }, [active, history]);

  const badge =
    tab === 'active'
      ? active.status === 'ready'
        ? `${active.orders.length} active`
        : undefined
      : history.status === 'ready'
        ? `${history.orders.length} in history`
        : undefined;

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
      }>
      <SectionHeader eyebrow="Orders" title="Track your deliveries" badge={badge} />
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
                  ? 'Nothing needs your attention right now. Past orders live in History.'
                  : "When you request a delivery, you'll follow it here. New orders stay pending until a helper picks them up."
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
                    subtitle={`${formatOrderDate(order.createdAt)} · ${order.location.name} · ${order.items.reduce((sum, item) => sum + item.quantity, 0)} items`}
                    onPress={() => openOrder(order)}
                    right={
                      <View style={styles.right}>
                        <Text variant="secondary" style={styles.subtotal}>
                          {formatMYR(order.subtotalCents)}
                        </Text>
                        <Badge label={orderStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
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
              message="Completed, cancelled, and settled orders will appear here as read-only records."
            />
          ) : null}
          {history.status === 'ready'
            ? history.orders.map((order) => (
                <Card key={order.id} style={styles.orderCard}>
                  <ListRow
                    icon="history"
                    title={order.vendor.name}
                    subtitle={`${formatOrderDate(order.createdAt)} · ${order.location.name} · ${order.items.reduce((sum, item) => sum + item.quantity, 0)} items`}
                    onPress={() => openOrder(order)}
                    right={
                      <View style={styles.right}>
                        <Text variant="secondary" style={styles.subtotal}>
                          {formatMYR(order.subtotalCents)}
                        </Text>
                        <Badge label={orderStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
                      </View>
                    }
                  />
                </Card>
              ))
            : null}
        </>
      )}
      <Card>
        <StageLegend caption="Every order moves through these five stages." />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  orderCard: { gap: 0 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  subtotal: { fontWeight: '700', color: colors.primary },
});
