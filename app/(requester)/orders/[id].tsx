import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { RequesterHistoryDetail } from '@/components/RequesterHistoryDetail';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { RequesterPaymentCard } from '@/components/RequesterPaymentCard';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import {
  formatOrderDate,
  isTerminalOrderStatus,
  orderItemsTitle,
  orderStatusTone,
  requesterStatusMessage,
} from '@/lib/orders';
import { cancelOrder, confirmDelivery, getOrderDetail, openDispute } from '@/services/orders';
import type { OrderStatus, OrderWithDetails } from '@/types/domain';
import type { RequesterDisputeReason } from '@/services/orders';

const DISPUTE_CATEGORIES: { key: RequesterDisputeReason; title: string }[] = [
  { key: 'not_received', title: "Didn't receive it" },
  { key: 'incorrect', title: 'Wrong or incomplete' },
  { key: 'damaged', title: 'Damaged or spoiled' },
  { key: 'refused', title: 'Refused at handover' },
];

const PROGRESS_STEPS: { key: string; label: string; done: OrderStatus[] }[] = [
  { key: 'placed', label: 'Placed', done: ['assigned', 'going_to_vendor', 'at_vendor', 'food_available', 'food_purchased', 'picked_up', 'out_for_delivery', 'delivering', 'delivered', 'confirmed', 'completed'] },
  { key: 'helper', label: 'Helper', done: ['going_to_vendor', 'at_vendor', 'food_available', 'food_purchased', 'picked_up', 'out_for_delivery', 'delivering', 'delivered', 'confirmed', 'completed'] },
  { key: 'food', label: 'Food ready', done: ['picked_up', 'out_for_delivery', 'delivering', 'delivered', 'confirmed', 'completed'] },
  { key: 'delivery', label: 'Delivered', done: ['delivered', 'confirmed', 'completed'] },
  { key: 'received', label: 'Received', done: ['confirmed', 'completed'] },
  { key: 'paid', label: 'Completed', done: ['completed'] },
];

/**
 * One-line explainer per in-progress status. Titles come from the shared
 * `requesterStatusMessage` so every surface agrees; no GPS, maps, distance,
 * or arrival estimates — the backend tracks none of those.
 */
const TRANSIT_DETAILS: Partial<Record<OrderStatus, string>> = {
  assigned: 'A helper accepted your request.',
  going_to_vendor: 'A helper has accepted your request and is going to collect the items.',
  at_vendor: 'Your helper is at the stall now.',
  food_available: 'The stall confirmed your items are available.',
  food_purchased: 'Your helper paid for the food at the stall.',
  picked_up: 'The helper has collected your requested items.',
  out_for_delivery: 'Your helper is bringing the request to your drop-off point.',
  delivering: 'Your helper is bringing the request to your drop-off point.',
};

/** Requester order detail: progress, totals, cancel, and post-delivery payment. */
export default function OrderDetailScreen() {
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
    try {
      const found = typeof id === 'string' ? await getOrderDetail(id) : null;
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

  // Reset per-order state during render when the route id changes (the
  // React-endorsed alternative to setState-in-effect); the effect below
  // then only refetches. Inert on mount: the initial values already match
  // the reset values.
  const [seenId, setSeenId] = useState(id);
  if (seenId !== id) {
    setSeenId(id);
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
  }

  // Mount + id-change fetch. Inlined rather than calling reload(): a
  // useEffect body may not call a state-setting callback
  // (react-hooks/set-state-in-effect) — state sets here live only in the
  // async continuation. reload() stays for realtime/handlers.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const found = typeof id === 'string' ? await getOrderDetail(id) : null;
        if (mounted) {
          setOrder(found);
          setStatus(found ? 'ready' : 'missing');
        }
      } catch {
        if (mounted) {
          setOrder(null);
          setStatus('missing');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

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
  const showCancel = cancellable || lateCancellable;
  const transitDetail = TRANSIT_DETAILS[order.status] ?? null;
  const isDelivered = order.status === 'delivered';

  return (
    <>
      <Stack.Screen options={{ title: order.vendor.name }} />
      <Screen>
        <View style={styles.heading}>
          <Text variant="title">{order.vendor.name}</Text>
        </View>
        <Text variant="subtitle">{orderItemsTitle(order.items)}</Text>
        <Badge label={requesterStatusMessage(order.status)} tone={orderStatusTone(order.status)} />
        <Text variant="caption" color="secondary">
          Request {order.id.slice(0, 8)}… · Placed {formatOrderDate(order.createdAt)}
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

        <Card>
          <OrderBreakdown
            items={order.items}
            subtotalCents={order.subtotalCents}
            deliveryFeeCents={order.deliveryFeeCents}
          />
          <Text variant="caption" color="muted">
            Pay only after the food is in your hands.
          </Text>
        </Card>

        {order.status === 'pending' ? (
          <Card>
            <Badge label={requesterStatusMessage(order.status)} tone={orderStatusTone(order.status)} />
            <Text variant="subtitle">Waiting for a helper</Text>
            <Text color="secondary">No action required — you will be notified when a helper accepts.</Text>
          </Card>
        ) : null}

        {transitDetail ? (
          <Card>
            <Badge label={requesterStatusMessage(order.status)} tone={orderStatusTone(order.status)} />
            <Text variant="subtitle">{requesterStatusMessage(order.status)}</Text>
            <Text color="secondary">{transitDetail}</Text>
          </Card>
        ) : null}

        {isDelivered ? (
          <>
            <SectionHeader title="Required action" />
            <Card>
              <Badge label="Delivered" tone="success" />
              <Text variant="subtitle">Confirm delivery</Text>
              <Text color="secondary">
                {order.deliveredAt ? `Delivered ${formatOrderDate(order.deliveredAt)}. ` : ''}
                The helper marked this request as delivered.
              </Text>
              {confirmError ? (
                <ErrorState title="Could not confirm" message={confirmError} retryTitle="Dismiss" onRetry={() => setConfirmError(null)} />
              ) : null}
              <Button
                title={confirming ? 'Confirming…' : 'Yes, confirm delivery'}
                onPress={() => void handleConfirm()}
                disabled={confirming}
                loading={confirming}
              />
              <Text variant="caption" color="muted">
                By confirming, you attest that you received the request.
              </Text>
              <Button
                title={reportOpen ? 'Hide problem report' : 'Report an issue'}
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
                  Reporting moves the order to dispute — no automatic refund.
                </Text>
              </View>
            ) : null}
            </Card>
          </>
        ) : null}

        <RequesterPaymentCard orderId={order.id} refreshToken={paymentTick} />

        {showCancel ? (
          <>
            <SectionHeader title="Other options" />
            <Card>
              <Text variant="subtitle">Cancel this order</Text>
              {lateCancellable ? (
                <Text color="secondary">
                  The helper already paid for your food. Cancelling now may make
                  you responsible for the food cost — settle it with them directly.
                </Text>
              ) : (
                <Text color="secondary">
                  Free of charge before the food is purchased.
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
          </>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, fontWeight: '600', color: colors.text },
  progress: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  step: { flex: 1, alignItems: 'center', gap: spacing.xs },
  dot: {
    width: 30,
    height: 30,
    borderRadius: radii.full,
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
