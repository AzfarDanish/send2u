import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { OrderBreakdown } from '@/components/OrderBreakdown';
import { TransactionRecord } from '@/components/TransactionRecord';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { formatMYR } from '@/lib/money';
import { orderItemsTitle, paymentMethodLabel, paymentStatusLabel } from '@/lib/orders';
import { advancePreparation, listVendorOrders, type VendorPrepAction } from '@/services/vendor';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Vendor order detail: items, quantities, food amount, payment method and
 * state, helper assignment, and the preparation actions valid now. The
 * helper collects the food — the vendor never collects payment from the
 * helper. Focused record view, not a POS.
 */
export default function VendorOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof id === 'string' ? id : null;
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<VendorPrepAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!orderId) {
      setStatus('missing');
      return;
    }
    try {
      const found = (await listVendorOrders()).find((o) => o.id === orderId) ?? null;
      setOrder(found);
      setStatus(found ? 'ready' : 'missing');
    } catch {
      setStatus('missing');
    }
  }, [orderId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!orderId) {
        if (mounted) setStatus('missing');
        return;
      }
      try {
        const found = (await listVendorOrders()).find((o) => o.id === orderId) ?? null;
        if (mounted) {
          setOrder(found);
          setStatus(found ? 'ready' : 'missing');
        }
      } catch {
        if (mounted) setStatus('missing');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  useRealtimeReload(orderId ? [{ table: 'send2u_orders', filter: `id=eq.${orderId}` }] : [], () => {
    void reload();
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const handleAdvance = useCallback(
    async (action: VendorPrepAction) => {
      if (!order || acting) return;
      const previous = order;
      setActing(action);
      setActionError(null);
      try {
        const nextStatus = await advancePreparation(order.id, action);
        setOrder({ ...previous, status: nextStatus });
      } catch (err) {
        setOrder(previous);
        setActionError(err instanceof Error ? err.message : 'Could not update preparation.');
      } finally {
        setActing(null);
      }
    },
    [order, acting],
  );

  if (!orderId || status !== 'ready' || !order) {
    return (
      <Screen>
        {status === 'loading' ? (
          <LoadingState message="Loading order…" />
        ) : (
          <ErrorState
            title="Order not found"
            message="This order isn't part of your stall."
            retryTitle="Back to orders"
            onRetry={() => router.back()}
          />
        )}
      </Screen>
    );
  }

  const onlineUnpaid = order.paymentMethod === 'online' && order.paymentStatus !== 'paid';
  const canPrepare =
    !onlineUnpaid && (order.status === 'pending' || order.status === 'assigned');
  const canMarkReady = order.status === 'preparing';

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
      }>
      <Text variant="title" numberOfLines={2}>
        {orderItemsTitle(order.items)}
      </Text>
      <Text variant="caption" color="secondary">
        {paymentMethodLabel(order.paymentMethod)} · {paymentStatusLabel(order.paymentStatus)}
        {order.helperId ? ' · helper assigned' : ' · waiting for helper'}
      </Text>

      <Card style={styles.card}>
        <Text variant="subtitle">Items</Text>
        {order.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text variant="secondary" style={styles.itemName} numberOfLines={2}>
              {item.quantity} × {item.itemName}
            </Text>
            <Text variant="secondary" style={styles.numeric}>
              {formatMYR(item.lineTotalCents)}
            </Text>
          </View>
        ))}
        <Text variant="caption" color="muted">
          {order.paymentMethod === 'online'
            ? order.paymentStatus === 'paid'
              ? 'Paid in Send2U — prepare with confidence.'
              : 'Waiting for the customer payment. Do not prepare yet.'
            : 'Cash on delivery — Send2U records the collection. Never collect payment from the helper.'}
        </Text>
      </Card>

      {actionError ? (
        <ErrorState
          title="Couldn't update preparation"
          message={actionError}
          retryTitle="Dismiss"
          onRetry={() => setActionError(null)}
        />
      ) : null}

      {canPrepare ? (
        <Button
          title={acting === 'start_preparing' ? 'Working…' : 'Start preparing'}
          onPress={() => void handleAdvance('start_preparing')}
          disabled={acting !== null}
          loading={acting === 'start_preparing'}
        />
      ) : null}
      {canMarkReady ? (
        <Button
          title={acting === 'mark_ready' ? 'Working…' : 'Mark ready for pickup'}
          onPress={() => void handleAdvance('mark_ready')}
          disabled={acting !== null}
          loading={acting === 'mark_ready'}
        />
      ) : null}
      {order.status === 'ready_for_pickup' ? (
        <Card style={styles.card}>
          <Text color="secondary">Ready for pickup. The helper will collect this order.</Text>
        </Card>
      ) : null}

      <OrderBreakdown
        items={[]}
        subtotalCents={order.subtotalCents}
        deliveryFeeCents={order.deliveryFeeCents}
      />
      <TransactionRecord orderId={order.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemName: { flex: 1, fontWeight: '600', color: colors.text },
  numeric: { fontVariant: ['tabular-nums'] as const },
});
