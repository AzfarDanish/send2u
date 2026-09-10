import { router } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

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
import { colors } from '@/constants/theme';
import { useMyOrders } from '@/hooks/useMyOrders';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, orderStatusLabel, orderStatusTone } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

export default function RequesterOrdersScreen() {
  const { orders, status, error, refreshing, retry, refresh } = useMyOrders();

  const openOrder = useCallback((order: OrderWithDetails) => {
    router.push({ pathname: '/(requester)/orders/[id]', params: { id: order.id } });
  }, []);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }>
      <SectionHeader
        eyebrow="Orders"
        title="Track your deliveries"
        badge={status === 'ready' ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : undefined}
      />
      {status === 'loading' ? (
        <Card style={styles.stateCard}>
          <LoadingState message="Loading your orders…" />
        </Card>
      ) : null}
      {status === 'error' ? (
        <Card style={styles.stateCard}>
          <ErrorState
            title="Couldn't load orders"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        </Card>
      ) : null}
      {status === 'empty' ? (
        <EmptyState
          icon="receipt-long"
          title="No orders yet"
          message="When you request a delivery, you'll follow it here. New orders stay pending until a helper picks them up."
          actionTitle="Browse menu"
          onAction={() => router.push('/(requester)')}
        />
      ) : null}
      {status === 'ready'
        ? orders.map((order) => (
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
      <Card>
        <StageLegend caption="Every order moves through these five stages." />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  orderCard: { gap: 0 },
  right: { alignItems: 'flex-end', gap: 4 },
  subtotal: { fontWeight: '700', color: colors.primary },
});
