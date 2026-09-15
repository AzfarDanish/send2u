import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { OrderBreakdown } from '@/components/OrderBreakdown';
import { OrderRatingSection } from '@/components/OrderRatingSection';
import { OrderTimeline } from '@/components/OrderTimeline';
import { ReceiptEvidenceView } from '@/components/ReceiptEvidenceView';
import { RequestProgress } from '@/components/RequestProgress';
import { RequestStatusCard, type StatusCardTone } from '@/components/RequestStatusCard';
import { RequesterPaymentCard } from '@/components/RequesterPaymentCard';
import { SettlementRecord } from '@/components/SettlementRecord';
import { GlassHeader } from '@/components/GlassHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { formatMYR } from '@/lib/money';
import { emitOrderChanged } from '@/lib/orderEvents';
import {
  formatOrderDate,
  isTerminalOrderStatus,
  orderStatusTone,
  orderTotalCents,
  paymentStatusLabel,
  paymentStatusTone,
  requesterStatusMessage,
} from '@/lib/orders';
import { cancelOrder, getOrderDetail, openDispute, withdrawDispute } from '@/services/orders';
import { helperLabel } from '@/services/helperIdentity';
import { useHelperIdentity } from '@/hooks/useHelperIdentity';
import type { OrderWithDetails } from '@/types/domain';
import type { RequesterDisputeReason } from '@/services/orders';

const DISPUTE_CATEGORIES: { key: RequesterDisputeReason; title: string }[] = [
  { key: 'not_received', title: "Didn't receive it" },
  { key: 'incorrect', title: 'Wrong or incomplete' },
  { key: 'damaged', title: 'Damaged or spoiled' },
  { key: 'refused', title: 'Refused at handover' },
];

/** Reasons the requester can retract — mirrors the RPC gate. */
const WITHDRAWABLE_REASONS: ReadonlySet<string> = new Set([
  'not_received',
  'incorrect',
  'damaged',
  'refused',
]);

interface StatusCardContent {
  tone: StatusCardTone;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
}

/**
 * Contextual status copy per real backend state. Describes only what the
 * backend tracks — a helper collecting and delivering food the requester
 * chose, paid externally after handover. Never claims restaurant prep,
 * drivers, arrival times, or in-app payment.
 */
function statusCardFor(order: OrderWithDetails): StatusCardContent {
  const vendor = order.vendor.name;
  const location = order.location.name;
  const total = formatMYR(orderTotalCents(order.subtotalCents, order.deliveryFeeCents));
  switch (order.status) {
    case 'pending':
    case 'preparing':
      return {
        tone: 'info',
        icon: 'receipt-long',
        title: 'Request submitted',
        description:
          'Your request has been sent to nearby helpers. We\u2019ll notify you when a helper accepts it.',
      };
    case 'assigned':
    case 'accepted':
      return {
        tone: 'info',
        icon: 'person-outline',
        title: 'A helper accepted your request',
        description: `Your helper is preparing to collect your food from ${vendor}.`,
      };
    case 'going_to_vendor':
      return {
        tone: 'info',
        icon: 'delivery-dining',
        title: 'Helper on the way to the stall',
        description: `Your helper is heading to ${vendor} to collect your items.`,
      };
    case 'at_vendor':
      return {
        tone: 'info',
        icon: 'storefront',
        title: 'Helper is at the stall',
        description: `Your helper is collecting your items at ${vendor}.`,
      };
    case 'food_available':
      return {
        tone: 'info',
        icon: 'storefront',
        title: 'Your items are available',
        description:
          'The stall confirmed your items are available. Your helper will pay for and collect them.',
      };
    case 'food_purchased':
      return {
        tone: 'info',
        icon: 'storefront',
        title: 'Food purchased',
        description: `Your helper paid for your items at ${vendor} and is getting them ready for pickup.`,
      };
    case 'picked_up':
    case 'ready_for_pickup':
      return {
        tone: 'info',
        icon: 'check-circle',
        title: 'Items collected',
        description: `Your helper has your items and is starting the trip to ${location}.`,
      };
    case 'out_for_delivery':
    case 'delivering':
      return {
        tone: 'warning',
        icon: 'delivery-dining',
        title: 'Your request is on the way',
        description: `Your helper is bringing your food to ${location}.`,
      };
    case 'delivered':
      return {
        tone: 'success',
        icon: 'check-circle',
        title: 'Food delivered — confirm receipt',
        description: `Your helper marked the request as delivered${
          order.deliveredAt ? ` (${formatOrderDate(order.deliveredAt)})` : ''
        }. Confirm below once you have your items.`,
      };
    case 'confirmed':
      return {
        tone: 'success',
        icon: 'check-circle',
        title: 'Receipt confirmed',
        description: 'Thanks for confirming. Complete the payment step below to finish the request.',
      };
    case 'awaiting_requester_payment':
      return {
        tone: 'warning',
        icon: 'account-balance-wallet',
        title: 'Payment pending',
        description: `Send ${total} to your helper externally, then submit the receipt below to complete the request.`,
      };
    case 'completed':
      return {
        tone: 'success',
        icon: 'verified',
        title: 'Request completed',
        description: 'This request was delivered and settled. Thanks for using Send2U.',
      };
    case 'cancelled':
      return {
        tone: 'error',
        icon: 'cancel',
        title: 'Request cancelled',
        description:
          order.cancelReason === 'food_unavailable'
            ? 'The stall had no food, so this request was cancelled. You owe nothing.'
            : order.cancelReason
              ? `Cancelled: ${order.cancelReason}${order.cancelledAt ? ` (${formatOrderDate(order.cancelledAt)})` : ''}`
              : 'This request was cancelled and is no longer active.',
      };
    case 'disputed':
      return {
        tone: 'error',
        icon: 'report-problem',
        title: 'Under review',
        description: disputeDescription(order),
      };
    default:
      return {
        tone: 'info',
        icon: 'receipt-long',
        title: requesterStatusMessage(order.status),
        description: 'Your request is being processed.',
      };
  }
}

function disputeDescription(order: OrderWithDetails): string {
  const flagged = order.disputedAt ? ` (flagged ${formatOrderDate(order.disputedAt)})` : '';
  const settled = order.resolvedAt
    ? ` Settled${order.resolution ? ` as ${order.resolution}` : ''} on ${formatOrderDate(order.resolvedAt)}.`
    : '';
  switch (order.disputeReason) {
    case 'late_cancellation':
      return `You cancelled after the helper paid ${order.foodCostCents ? formatMYR(order.foodCostCents) : 'for the food'}. Settle with your helper directly.${settled}`;
    case 'delivery_failed':
      return `The delivery could not be completed. Settle any food cost directly.${flagged}${settled}`;
    case 'helper_unable':
      return `Your helper could not continue after paying ${order.foodCostCents ? formatMYR(order.foodCostCents) : 'for the food'}. Settle with them directly.${flagged}${settled}`;
    case 'not_received':
      return `You reported the food as not received.${flagged}${settled}`;
    case 'incorrect':
      return `You reported wrong or incomplete items.${flagged}${settled}`;
    case 'damaged':
      return `You reported damaged or spoiled food.${flagged}${settled}`;
    case 'refused':
      return `You reported the handover was refused.${flagged}${settled}`;
    default:
      return `This request is under review.${flagged}${settled}`;
  }
}

/**
 * Request Detail: the requester's single view of one request — header,
 * progress, status, order summary, drop-off, and the actions valid for the
 * current backend state. Live-updates over the existing realtime channel;
 * terminal orders render as read-only records.
 */
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [paymentTick, setPaymentTick] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<RequesterDisputeReason | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const found = typeof id === 'string' ? await getOrderDetail(id) : null;
      setOrder(found);
      setLoadFailed(false);
      setStatus(found ? 'ready' : 'missing');
    } catch {
      // Transient refresh failure: keep whatever is on screen rather than
      // flashing a misleading "not found" state. Realtime and manual
      // refresh paths retry; the next successful load reconciles.
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
    setPaymentTick(0);
    setReportOpen(false);
    setReportCategory(null);
    setReportDetails('');
    setReportError(null);
    setWithdrawError(null);
    setMenuOpen(false);
    setLoadFailed(false);
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
          setLoadFailed(false);
          setStatus(found ? 'ready' : 'missing');
        }
      } catch {
        if (mounted) {
          setOrder(null);
          setLoadFailed(true);
          setStatus('missing');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, retryToken]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  // Status-changing handlers patch the visible order from the RPC's
  // authoritative `{status}` instead of refetching the whole record, then
  // broadcast it so mounted lists update the same card in place. Other
  // fields (timestamps, payment) reconcile via the realtime echo / manual
  // refresh. Failures restore the previous order — the UI never shows a
  // state the backend rejected.
  const handleCancel = useCallback(async () => {
    if (!order || cancelling) return;
    const previous = order;
    setCancelling(true);
    setCancelError(null);
    try {
      const result = await cancelOrder(order.id, reason);
      const patched = { ...previous, status: result.status };
      setOrder(patched);
      emitOrderChanged(patched);
      setCancelled(true);
    } catch (err) {
      setOrder(previous);
      setCancelError(err instanceof Error ? err.message : 'Could not cancel the order.');
    } finally {
      setCancelling(false);
    }
  }, [order, cancelling, reason]);

  // Delivery confirmation lives on the dedicated confirm screen (checklist
  // + attestation); the detail screen routes there instead of confirming
  // inline. Report/withdraw stay inline — they belong to this record view.
  const { identity: helperIdentity } = useHelperIdentity(
    typeof id === 'string' ? id : '',
    order?.helperId ?? null,
  );

  const handleReport = useCallback(async () => {
    if (!order || reporting || !reportCategory) return;
    const previous = order;
    setReporting(true);
    setReportError(null);
    try {
      const result = await openDispute(order.id, reportCategory, reportDetails.trim().length > 0 ? reportDetails : null);
      const patched = { ...previous, status: result.status };
      setOrder(patched);
      emitOrderChanged(patched);
      // Close the form on success: the order left the delivered state, so
      // the report UI unmounts anyway — don't leave stale inputs behind.
      setReportOpen(false);
      setReportCategory(null);
      setReportDetails('');
    } catch (err) {
      setOrder(previous);
      setReportError(err instanceof Error ? err.message : 'Could not report the problem.');
    } finally {
      setReporting(false);
    }
  }, [order, reporting, reportCategory, reportDetails]);

  const handleWithdraw = useCallback(async () => {
    if (!order || withdrawing) return;
    const previous = order;
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      const result = await withdrawDispute(order.id);
      const patched = { ...previous, status: result.status };
      setOrder(patched);
      emitOrderChanged(patched);
    } catch (err) {
      setOrder(previous);
      setWithdrawError(err instanceof Error ? err.message : 'Could not withdraw the report.');
    } finally {
      setWithdrawing(false);
    }
  }, [order, withdrawing]);

  if (status === 'loading' || !order) {
    return (
      <>
        <GlassHeader title="Request Detail" />
        <Screen beneathHeader>
          {status === 'loading' ? (
            <LoadingState message="Loading request…" />
          ) : loadFailed ? (
            <ErrorState
              title="Couldn't load the request"
              message="Check your connection and try again."
              retryTitle="Try again"
              onRetry={() => {
                setLoadFailed(false);
                setStatus('loading');
                setRetryToken((t) => t + 1);
              }}
            />
          ) : (
            <ErrorState
              title="Request not found"
              message="This request isn't available to you. It may belong to another requester."
              retryTitle="Back to requests"
              onRetry={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(requester)/orders');
              }}
            />
          )}
        </Screen>
      </>
    );
  }

  const terminal = isTerminalOrderStatus(order.status);
  const card = statusCardFor(order);

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
    (order.status === 'food_purchased' ||
      order.status === 'picked_up' ||
      order.status === 'out_for_delivery' ||
      order.status === 'delivering');
  const showCancel = cancellable || lateCancellable;
  const isDelivered = order.status === 'delivered';
  const canWithdraw =
    order.status === 'disputed' &&
    !order.resolvedAt &&
    !!order.disputeReason &&
    WITHDRAWABLE_REASONS.has(order.disputeReason);

  const menuItems: { key: string; icon: keyof typeof MaterialIcons.glyphMap; title: string; onPress: () => void }[] =
    [];
  if (isDelivered) {
    menuItems.push({
      key: 'report',
      icon: 'report-problem',
      title: 'Report an issue',
      onPress: () => {
        setMenuOpen(false);
        setReportOpen(true);
      },
    });
  }
  menuItems.push({
    key: 'help',
    icon: 'help-outline',
    title: 'Get help',
    onPress: () => {
      setMenuOpen(false);
      router.push('/(requester)/help');
    },
  });
  if (terminal) {
    menuItems.push({
      key: 'browse',
      icon: 'restaurant-menu',
      title: 'Browse menu',
      onPress: () => {
        setMenuOpen(false);
        router.push('/(requester)');
      },
    });
  }

  return (
    <>
      <GlassHeader title="Request Detail" />
      <Screen
        beneathHeader
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
        }>
        <View style={styles.headerRow}>
          <Text variant="title" style={styles.requestId} numberOfLines={1} ellipsizeMode="tail">
            #{order.id.slice(0, 8)}
          </Text>
          <View style={styles.headerRight}>
            <Badge label={requesterStatusMessage(order.status)} tone={orderStatusTone(order.status)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More actions"
              onPress={() => setMenuOpen((open) => !open)}
              style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
              hitSlop={8}>
              <MaterialIcons name="more-vert" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>
        <Text variant="caption" color="secondary">
          Placed {formatOrderDate(order.createdAt)}
          {order.helperId
            ? ` · ${helperLabel(helperIdentity, order.helperId)}${order.acceptedAt ? ` accepted ${formatOrderDate(order.acceptedAt)}` : ''}`
            : ''}
        </Text>

        <RequestProgress order={order} />

        <RequestStatusCard tone={card.tone} icon={card.icon} title={card.title} description={card.description} />

        <Text variant="subtitle">Order Summary</Text>
        <Card>
          <View style={styles.row}>
            <MaterialIcons name="storefront" size={20} color={colors.primary} />
            <View style={styles.rowText}>
              <Text variant="secondary" style={styles.vendorName} numberOfLines={2}>
                {order.vendor.name}
              </Text>
              {order.vendor.locationHint ? (
                <Text variant="caption" color="secondary" numberOfLines={2}>
                  {order.vendor.locationHint}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.divider} />
          <OrderBreakdown
            items={order.items}
            subtotalCents={order.subtotalCents}
            deliveryFeeCents={order.deliveryFeeCents}
          />
          <Text variant="caption" color="muted">
            Pay only after the food is in your hands.
          </Text>
        </Card>

        <Text variant="subtitle">Drop-off Location</Text>
        <Card>
          <View style={styles.row}>
            <MaterialIcons name="place" size={20} color={colors.error} />
            <Text variant="secondary" style={styles.rowText} numberOfLines={2}>
              {order.location.name}
            </Text>
          </View>
        </Card>

        {isDelivered ? (
          <Card>
            <Badge label="Delivered" tone="success" />
            <Text variant="subtitle">Confirm receipt</Text>
            <Text color="secondary">Did you receive your items?</Text>
            <Button
              title="Review & confirm"
              onPress={() =>
                router.push({ pathname: '/(requester)/orders/[id]/confirm', params: { id: order.id } })
              }
            />
            <Text variant="caption" color="muted">
              Check your items against the confirmation checklist. Confirm only after
              you have your items.
            </Text>
            <Button
              title={reportOpen ? 'Hide problem report' : 'Report an issue'}
              variant="secondary"
              onPress={() => setReportOpen((open) => !open)}
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
        ) : null}

        {!terminal ? <RequesterPaymentCard orderId={order.id} refreshToken={paymentTick} /> : null}

        {!terminal &&
        (order.status === 'confirmed' || order.status === 'awaiting_requester_payment') &&
        !order.payment ? (
          <Button
            title="Continue to Payment"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/(requester)/orders/[id]/payment', params: { id: order.id } })
            }
          />
        ) : null}

        {showCancel ? (
          <Card>
            <Text variant="subtitle">Cancel this request</Text>
            {lateCancellable ? (
              <Text color="secondary">
                The helper already paid for your food. Cancelling now may make
                you responsible for the food cost — settle it with them directly.
              </Text>
            ) : (
              <Text color="secondary">Free of charge before the food is purchased.</Text>
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
              title={cancelling ? 'Cancelling…' : 'Cancel request'}
              variant="danger"
              onPress={() => void handleCancel()}
              disabled={cancelling || reason.trim().length === 0}
              loading={cancelling}
            />
          </Card>
        ) : null}

        {terminal ? (
          <>
            {order.status === 'completed' || order.status === 'cancelled' ? (
              <SettlementRecord order={order} />
            ) : null}
            {order.status === 'completed' ? (
              <OrderRatingSection order={order} refreshToken={paymentTick} />
            ) : null}
            {order.status === 'cancelled' || order.status === 'disputed' ? (
              <Card>
                <Text variant="subtitle">What happened</Text>
                <OrderTimeline order={order} />
              </Card>
            ) : null}
            {order.disputeDetails ? (
              <Card>
                <Text variant="subtitle">Your report</Text>
                <Text color="secondary">{order.disputeDetails}</Text>
                {order.disputeNote ? (
                  <Text variant="caption" color="muted">
                    Resolution note: {order.disputeNote}
                  </Text>
                ) : null}
              </Card>
            ) : null}
            {canWithdraw ? (
              <Card>
                {withdrawError ? (
                  <ErrorState title="Could not withdraw" message={withdrawError} retryTitle="Dismiss" onRetry={() => setWithdrawError(null)} />
                ) : null}
                <Button
                  title={withdrawing ? 'Withdrawing…' : 'Withdraw report'}
                  variant="secondary"
                  onPress={() => void handleWithdraw()}
                  disabled={withdrawing}
                  loading={withdrawing}
                />
              </Card>
            ) : null}
            <Card>
              <View style={styles.moneyRow}>
                <Text variant="subtitle">Payment record</Text>
                {order.payment ? (
                  <Badge label={paymentStatusLabel(order.payment.status)} tone={paymentStatusTone(order.payment.status)} />
                ) : (
                  <Badge label="No payment" tone="neutral" />
                )}
              </View>
              {order.payment ? (
                <>
                  <Text color="secondary">
                    {formatMYR(order.payment.amountCents)} · submitted{' '}
                    {formatOrderDate(order.payment.submittedAt)}
                    {order.payment.verifiedAt
                      ? ` · reviewed ${formatOrderDate(order.payment.verifiedAt)}`
                      : ''}
                    .
                  </Text>
                  <ReceiptEvidenceView path={order.payment.evidencePath} />
                </>
              ) : (
                <Text color="secondary">
                  {order.status === 'completed'
                    ? 'No payment record was stored for this order.'
                    : 'No payment was submitted for this order.'}
                </Text>
              )}
              {order.status === 'cancelled' && order.cancelReason === 'food_unavailable' ? (
                <Text variant="caption" color="muted">
                  No payment was due.
                </Text>
              ) : null}
            </Card>
            <View style={styles.actionRow}>
              <View style={styles.actionFill}>
                <Button title="Browse menu" onPress={() => router.push('/(requester)')} />
              </View>
              <View style={styles.actionFill}>
                <Button title="Need help?" variant="secondary" onPress={() => router.push('/(requester)/help')} />
              </View>
            </View>
          </>
        ) : (
          <Button title="Need help?" variant="secondary" onPress={() => router.push('/(requester)/help')} />
        )}
      </Screen>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu">
          <View style={styles.menuCard}>
            {menuItems.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={item.onPress}
                style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
                <MaterialIcons name={item.icon} size={20} color={colors.text} />
                <Text variant="secondary">{item.title}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  requestId: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
    paddingTop: 120,
    paddingRight: spacing.lg,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: spacing.xs,
    minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, fontWeight: '600', color: colors.text },
  vendorName: { fontWeight: '600', color: colors.text },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
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
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionFill: { flex: 1 },
});
