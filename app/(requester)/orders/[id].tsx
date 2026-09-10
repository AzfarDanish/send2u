import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { RequesterPaymentCard } from '@/components/RequesterPaymentCard';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, orderStatusLabel, orderStatusTone } from '@/lib/orders';
import { cancelOrder, getOrderDetail } from '@/services/orders';
import type { OrderStatus, OrderWithDetails } from '@/types/domain';

const PROGRESS_STEPS: { key: string; label: string; done: OrderStatus[] }[] = [
  { key: 'placed', label: 'Placed', done: ['assigned', 'going_to_vendor', 'at_vendor', 'food_available', 'food_purchased', 'picked_up', 'out_for_delivery', 'delivering', 'delivered', 'awaiting_requester_payment', 'completed'] },
  { key: 'helper', label: 'Helper', done: ['going_to_vendor', 'at_vendor', 'food_available', 'food_purchased', 'picked_up', 'out_for_delivery', 'delivering', 'delivered', 'awaiting_requester_payment', 'completed'] },
  { key: 'food', label: 'Food ready', done: ['picked_up', 'out_for_delivery', 'delivering', 'delivered', 'awaiting_requester_payment', 'completed'] },
  { key: 'delivery', label: 'Delivered', done: ['delivered', 'awaiting_requester_payment', 'completed'] },
  { key: 'paid', label: 'Completed', done: ['completed'] },
];

/** Requester order detail: progress, totals, cancel, and post-delivery payment. */
export default function OrderDetailScreen() {
  const getStatusMessage = (status: OrderStatus): string => {
    switch (status) {
      case 'pending':
        return 'Finding a helper';
      case 'assigned':
        return 'Helper assigned';
      case 'going_to_vendor':
        return 'Helper is going to the cafe';
      case 'at_vendor':
        return 'Helper is at the cafe';
      case 'food_available':
        return 'Food confirmed available';
      case 'food_purchased':
        return 'Food purchased';
      case 'picked_up':
        return 'Food picked up';
      case 'out_for_delivery':
      case 'delivering':
        return 'Out for delivery';
      case 'delivered':
        return 'Delivered';
      case 'awaiting_requester_payment':
        return 'Payment required';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'disputed':
        return 'Needs settlement';
      default:
        return orderStatusLabel(status);
    }
  };
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const reload = useCallback(async () => {
    if (typeof id !== 'string') {
      setOrder(null);
      setStatus('missing');
      return;
    }
    try {
      const found = await getOrderDetail(id);
      setOrder(found);
      setStatus(found ? 'ready' : 'missing');
    } catch {
      setOrder(null);
      setStatus('missing');
    }
  }, [id]);

  useEffect(() => {
    setStatus('loading');
    setOrder(null);
    setCancelError(null);
    setCancelled(false);
    setReason('');
    void reload();
  }, [id, reload]);

  const handleCancel = useCallback(async () => {
    if (!order || cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelOrder(order.id, reason);
      setCancelled(true);
      await reload();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Could not cancel the order.');
    } finally {
      setCancelling(false);
    }
  }, [order, cancelling, reason, reload]);

  if (status === 'loading' || !order) {
    return (
      <>
        <Stack.Screen options={{ title: 'Order details' }} />
        <Screen>
          {status === 'loading' ? (
            <LoadingState message="Loading order…" />
          ) : (
            <ErrorState
              title="Order not found"
              message="This order isn't available to you. It may belong to another requester."
              retryTitle="Back to orders"
              onRetry={() => router.back()}
            />
          )}
        </Screen>
      </>
    );
  }

  const cancellable =
    !cancelled &&
    (order.status === 'pending' || order.status === 'assigned' || order.status === 'going_to_vendor' || order.status === 'at_vendor');
  const lateCancellable =
    !cancelled &&
    (order.status === 'food_available' || order.status === 'food_purchased' || order.status === 'picked_up' || order.status === 'out_for_delivery' || order.status === 'delivering');

  return (
    <>
      <Stack.Screen options={{ title: order.vendor.name }} />
      <Screen>
        <View style={styles.heading}>
          <Text variant="title">{order.vendor.name}</Text>
          <Badge label={getStatusMessage(order.status)} tone={orderStatusTone(order.status)} />
        </View>
        <Text variant="caption" color="secondary">
          Placed {formatOrderDate(order.createdAt)} · Pickup ref {order.pickupCode}
        </Text>

        {order.status !== 'cancelled' && order.status !== 'disputed' ? (
          <Card>
            <View style={styles.progress}>
              {PROGRESS_STEPS.map((step, index) => {
                const reached = step.done.includes(order.status);
                return (
                  <View key={step.key} style={styles.step}>
                    <View style={[styles.dot, reached && styles.dotDone]}>
                      <Text variant="caption" color={reached ? 'primary' : 'muted'}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text variant="caption" color={reached ? 'primary' : 'muted'}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        <Card>
          <View style={styles.row}>
            <MaterialIcons name="place" size={20} color={colors.primary} />
            <Text variant="secondary" style={styles.rowText}>
              {order.location.name}
            </Text>
          </View>
          <Text variant="caption" color="muted">
            {order.vendor.locationHint ?? 'Campus vendor'}
          </Text>
        </Card>

        <Card style={styles.itemsCard}>
          {order.items.map((item) => (
            <View key={item.id} style={styles.line}>
              <View style={styles.lineText}>
                <Text variant="secondary" style={styles.lineName}>
                  {item.quantity} × {item.itemName}
                </Text>
                <Text variant="caption" color="secondary">
                  {formatMYR(item.unitPriceCents)} each
                </Text>
              </View>
              <Text variant="secondary" style={styles.lineTotal}>
                {formatMYR(item.lineTotalCents)}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <View style={styles.subtotalRow}>
            <Text color="secondary">Food subtotal</Text>
            <Text variant="subtitle">{formatMYR(order.subtotalCents)}</Text>
          </View>
          <View style={styles.subtotalRow}>
            <Text color="secondary">Delivery fee</Text>
            <Text variant="subtitle">{formatMYR(order.deliveryFeeCents)}</Text>
          </View>
          <View style={styles.subtotalRow}>
            <Text variant="subtitle">Total to pay helper</Text>
            <Text variant="title" color="primary">
              {formatMYR(order.subtotalCents + order.deliveryFeeCents)}
            </Text>
          </View>
          <Text variant="caption" color="muted">
            You pay after the food is in your hands — never before delivery.
          </Text>
        </Card>

        {order.status === 'cancelled' ? (
          <Card>
            <Badge label="Cancelled" tone="error" />
            <Text color="secondary">
              {order.cancelReason === 'food_unavailable'
                ? 'The stall had no food, so this order was stopped. You owe nothing.'
                : `Cancelled${order.cancelReason ? `: ${order.cancelReason}` : ''}.`}
            </Text>
          </Card>
        ) : null}

        {order.status === 'disputed' ? (
          <Card>
            <Badge label="Needs settlement" tone="error" />
            <Text variant="subtitle">This order needs settling up</Text>
            <Text color="secondary">
              {order.disputeReason === 'late_cancellation'
                ? `You cancelled after the helper had already paid ${order.foodCostCents ? formatMYR(order.foodCostCents) : 'for the food'}. Settle the food cost with your helper directly — Send2U never moves money itself.`
                : order.disputeReason === 'delivery_failed'
                  ? 'The delivery could not be completed. Settle any food cost with your helper directly.'
                  : 'This order is under review.'}
            </Text>
          </Card>
        ) : null}

        {order.status === 'completed' ? (
          <Card>
            <Badge label="Completed" tone="success" />
            <Text color="secondary">
              Delivered and paid. Thanks for using Send2U.
            </Text>
          </Card>
        ) : null}

        {cancellable || lateCancellable ? (
          <Card>
            <Text variant="subtitle">Cancel this order</Text>
            {lateCancellable ? (
              <Text color="secondary">
                The helper already paid for your food with their own money. Cancelling now may make
                you responsible for the food cost — settle it with them directly.
              </Text>
            ) : (
              <Text color="secondary">
                You can cancel free of charge before the food is purchased.
              </Text>
            )}
            {cancelError ? (
              <ErrorState title="Could not cancel" message={cancelError} retryTitle="Dismiss" onRetry={() => setCancelError(null)} />
            ) : null}
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for cancelling"
              placeholderTextColor={colors.muted}
              maxLength={500}
              editable={!cancelling}
              style={styles.reasonInput}
              accessibilityLabel="Cancellation reason"
            />
            <Button
              title={cancelling ? 'Cancelling…' : 'Cancel order'}
              variant="danger"
              onPress={() => void handleCancel()}
              disabled={cancelling || reason.trim().length === 0}
              loading={cancelling}
            />
          </Card>
        ) : null}

        <RequesterPaymentCard orderId={order.id} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, fontWeight: '600', color: colors.text },
  itemsCard: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  lineText: { flex: 1, gap: 2 },
  lineName: { fontWeight: '600', color: colors.text },
  lineTotal: { fontWeight: '700', color: colors.primary },
  subtotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.disabledBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.primarySoft },
  reasonInput: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
