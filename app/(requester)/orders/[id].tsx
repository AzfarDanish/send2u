import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { RequesterHistoryDetail } from '@/components/RequesterHistoryDetail';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { RequesterPaymentCard } from '@/components/RequesterPaymentCard';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, isTerminalOrderStatus, orderStatusLabel, orderStatusTone } from '@/lib/orders';
import { cancelOrder, confirmDelivery, getOrderDetail, openDispute } from '@/services/orders';
import type { OrderStatus, OrderWithDetails } from '@/types/domain';
import type { RequesterDisputeReason } from '@/services/orders';

const DISPUTE_CATEGORIES: { key: RequesterDisputeReason; title: string; subtitle: string }[] = [
  { key: 'not_received', title: "Didn't receive it", subtitle: 'The food never reached you.' },
  { key: 'incorrect', title: 'Wrong or incomplete', subtitle: 'Items missing or not what you ordered.' },
  { key: 'damaged', title: 'Damaged or spoiled', subtitle: 'Food arrived inedible or spilled.' },
  { key: 'refused', title: 'Refused at handover', subtitle: 'You turned the delivery away.' },
];

const PROGRESS_STEPS: { key: string; label: string; done: OrderStatus[] }[] = [
  { key: 'placed', label: 'Placed', done: ['assigned', 'going_to_vendor', 'at_vendor', 'food_available', 'food_purchased', 'picked_up', 'out_for_delivery', 'delivering', 'delivered', 'confirmed', 'awaiting_requester_payment', 'completed'] },
  { key: 'helper', label: 'Helper', done: ['going_to_vendor', 'at_vendor', 'food_available', 'food_purchased', 'picked_up', 'out_for_delivery', 'delivering', 'delivered', 'confirmed', 'awaiting_requester_payment', 'completed'] },
  { key: 'food', label: 'Food ready', done: ['picked_up', 'out_for_delivery', 'delivering', 'delivered', 'confirmed', 'awaiting_requester_payment', 'completed'] },
  { key: 'delivery', label: 'Delivered', done: ['delivered', 'confirmed', 'awaiting_requester_payment', 'completed'] },
  { key: 'received', label: 'Received', done: ['confirmed', 'awaiting_requester_payment', 'completed'] },
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
        return 'Delivered — confirm receipt';
      case 'confirmed':
        return 'Confirmed — payment required';
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
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [paymentTick, setPaymentTick] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<RequesterDisputeReason | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

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

  // Live updates (helper advances, reviews payment, rates…). RLS-scoped to
  // this order; failures fall back to the focus/manual paths.
  useRealtimeReload(
    typeof id === 'string'
      ? [
          { table: 'send2u_orders', filter: `id=eq.${id}` },
          { table: 'send2u_ratings', filter: `order_id=eq.${id}` },
        ]
      : [],
    () => {
      void reload();
      setPaymentTick((t) => t + 1);
    },
  );

  useEffect(() => {
    setStatus('loading');
    setOrder(null);
    setCancelError(null);
    setCancelled(false);
    setReason('');
    setConfirmError(null);
    setPaymentTick(0);
    setReportOpen(false);
    setReportCategory(null);
    setReportDetails('');
    setReportError(null);
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

  const handleConfirm = useCallback(async () => {
    if (!order || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      await confirmDelivery(order.id);
      await reload();
      setPaymentTick((t) => t + 1);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Could not confirm delivery.');
    } finally {
      setConfirming(false);
    }
  }, [order, confirming, reload]);

  const handleReport = useCallback(async () => {
    if (!order || reporting || !reportCategory) return;
    setReporting(true);
    setReportError(null);
    try {
      await openDispute(order.id, reportCategory, reportDetails.trim().length > 0 ? reportDetails : null);
      await reload();
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Could not report the problem.');
    } finally {
      setReporting(false);
    }
  }, [order, reporting, reportCategory, reportDetails, reload]);

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

  // Terminal orders are historical records: same route, strictly read-only
  // rendering. No cancel input, no payment actions — see RequesterHistoryDetail.
  if (isTerminalOrderStatus(order.status)) {
    return (
      <>
        <Stack.Screen options={{ title: `${order.vendor.name} · History` }} />
        <Screen>
          <RequesterHistoryDetail order={order} onChanged={() => void reload()} refreshToken={paymentTick} />
        </Screen>
      </>
    );
  }

  // Clean cancellation is possible while no food has been purchased — that
  // includes `food_available` (the purchase step itself leaves that status,
  // so no money can have been spent there). Past purchase, cancelling moves
  // the order to dispute with the helper's fronted cost preserved.
  const cancellable =
    !cancelled &&
    (order.status === 'pending' ||
      order.status === 'assigned' ||
      order.status === 'going_to_vendor' ||
      order.status === 'at_vendor' ||
      order.status === 'food_available');
  const lateCancellable =
    !cancelled &&
    (order.status === 'food_purchased' || order.status === 'picked_up' || order.status === 'out_for_delivery' || order.status === 'delivering');

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

        {order.status === 'delivered' ? (
          <Card>
            <Badge label="Delivery arrived" tone="success" />
            <Text variant="subtitle">Confirm you got the food</Text>
            <Text color="secondary">
              {order.deliveredAt ? `Delivered ${formatOrderDate(order.deliveredAt)}. ` : ''}
              Check the handover, then confirm below — payment opens right after
              confirmation.
            </Text>
            {confirmError ? (
              <ErrorState title="Could not confirm" message={confirmError} retryTitle="Dismiss" onRetry={() => setConfirmError(null)} />
            ) : null}
            <Button
              title={confirming ? 'Confirming…' : 'Confirm receipt'}
              onPress={() => void handleConfirm()}
              disabled={confirming}
              loading={confirming}
            />
            <Text variant="caption" color="muted">
              Only confirm food you actually received. If something is wrong,
              don&apos;t confirm — talk to your helper first.
            </Text>
            <Button
              title={reportOpen ? 'Hide problem report' : 'Report a problem'}
              variant="secondary"
              onPress={() => setReportOpen((open) => !open)}
              disabled={confirming}
            />
            {reportOpen ? (
              <View style={styles.reportForm}>
                <Text color="secondary">What went wrong?</Text>
                {DISPUTE_CATEGORIES.map((category) => {
                  const selected = reportCategory === category.key;
                  return (
                    <ListRow
                      key={category.key}
                      icon="report-problem"
                      title={category.title}
                      subtitle={category.subtitle}
                      showChevron={false}
                      onPress={() => setReportCategory(category.key)}
                      right={
                        selected ? (
                          <MaterialIcons name="check-circle" size={24} color={colors.primary} />
                        ) : undefined
                      }
                    />
                  );
                })}
                <TextInput
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  placeholder="Details for the record (optional)"
                  placeholderTextColor={colors.muted}
                  maxLength={500}
                  editable={!reporting}
                  style={styles.reasonInput}
                  accessibilityLabel="Dispute details"
                />
                {reportError ? (
                  <ErrorState title="Could not report" message={reportError} retryTitle="Dismiss" onRetry={() => setReportError(null)} />
                ) : null}
                <Button
                  title={reporting ? 'Reporting…' : 'Submit problem report'}
                  variant="danger"
                  onPress={() => void handleReport()}
                  disabled={reporting || !reportCategory}
                  loading={reporting}
                />
                <Text variant="caption" color="muted">
                  Reporting moves the order to dispute for manual settlement — no
                  automatic refund. Only report genuine problems.
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        <RequesterPaymentCard orderId={order.id} refreshToken={paymentTick} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, fontWeight: '600', color: colors.text },
  itemsCard: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  lineText: { flex: 1, gap: spacing.xs },
  lineName: { fontWeight: '600', color: colors.text },
  lineTotal: { fontWeight: '700', color: colors.primary },
  subtotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  step: { flex: 1, alignItems: 'center', gap: spacing.xs },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.disabledBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.primarySoft },
  reasonInput: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  reportForm: { gap: spacing.md },
});
