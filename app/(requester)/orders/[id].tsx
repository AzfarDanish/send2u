import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { OrderBreakdown } from '@/components/OrderBreakdown';
import { OrderRatingSection } from '@/components/OrderRatingSection';
import { OrderTimeline } from '@/components/OrderTimeline';
import { RequestProgress } from '@/components/RequestProgress';
import type { StatusCardTone } from '@/components/RequestStatusCard';
import { RequesterPaymentCard } from '@/components/RequesterPaymentCard';
import { TransactionRecord } from '@/components/TransactionRecord';
import { GlassHeader } from '@/components/GlassHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonDetail } from '@/components/ui/LoadingBlocks';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { emitOrderChanged } from '@/lib/orderEvents';
import {
  formatOrderDate,
  isTerminalOrderStatus,
  paymentStatusLabel,
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
 * backend tracks — a cafeteria preparing Send2U-covered food and a helper
 * collecting and delivering it. Never claims arrival times, and never asks
 * the requester to pay anyone outside Send2U.
 */
function statusCardFor(order: OrderWithDetails): StatusCardContent {
  const vendor = order.vendor.name;
  const location = order.location.name;
  switch (order.status) {
    case 'pending':
      return {
        tone: 'info',
        icon: 'receipt-long',
        title: 'Request submitted',
        description:
          order.paymentMethod === 'online' && order.paymentStatus !== 'paid'
            ? 'Complete your online payment to fire the kitchen. Helpers can already see your request.'
            : 'Your request has been sent to nearby helpers. We\u2019ll notify you when a helper accepts it.',
      };
    case 'preparing':
      return {
        tone: 'info',
        icon: 'storefront',
        title: `${vendor} is preparing your food`,
        description: 'The cafeteria confirmed your order and is getting it ready.',
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
          'The stall confirmed your items are available. Your helper will collect them — everything is covered by Send2U.',
      };
    case 'food_purchased':
      return {
        tone: 'info',
        icon: 'storefront',
        title: 'Food collected from the stall',
        description: `Your items at ${vendor} are secured and being readied for pickup. Your helper never pays for your food.`,
      };
    case 'picked_up':
      return {
        tone: 'info',
        icon: 'check-circle',
        title: 'Items collected',
        description: `Your helper has your items and is starting the trip to ${location}.`,
      };
    case 'ready_for_pickup':
      return {
        tone: 'info',
        icon: 'check-circle',
        title: 'Food is ready for pickup',
        description: `The cafeteria finished preparing your food. Your helper will collect it shortly.`,
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
        description:
          order.paymentStatus === 'paid' || order.paymentStatus === 'collected'
            ? 'Thanks for confirming. Your transaction is settling.'
            : order.paymentMethod === 'cod'
              ? 'Thanks for confirming. Your cash payment will be recorded by your helper.'
              : 'Thanks for confirming. Finish your online payment to complete the request.',
      };
    case 'awaiting_requester_payment':
      return {
        tone: 'warning',
        icon: 'account-balance-wallet',
        title: 'Finishing up',
        description: 'Your transaction is being settled.',
      };
    case 'completed':
      return {
        tone: 'success',
        icon: 'verified',
        title: 'Request completed',
        description: 'Delivered and recorded by Send2U. Thanks for using Send2U.',
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
      return `You cancelled after the kitchen committed to your order. It is under review — you carry no food-cost debt since helpers never pay for food.${settled}`;
    case 'delivery_failed':
      return `The delivery could not be completed and is under review.${flagged}${settled}`;
    case 'helper_unable':
      return `Your helper could not continue the delivery. Your order is under review.${flagged}${settled}`;
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

/** Title color per status tone: meaning carried by labeled text, never a badge. */
const STATUS_TONE_COLOR: Record<StatusCardTone, string> = {
  info: colors.info,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
};

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
  const [cancelOpen, setCancelOpen] = useState(false);
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

  // Live updates (helper advances, vendor prep, payment, settlement,
  // ratings…). RLS-scoped to this order; failures fall back to the
  // focus/manual paths.
  useRealtimeReload(
    typeof id === 'string'
      ? [
          { table: 'send2u_orders', filter: `id=eq.${id}` },
          { table: 'send2u_payments', filter: `order_id=eq.${id}` },
          { table: 'send2u_settlements', filter: `order_id=eq.${id}` },
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
    setCancelOpen(false);
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
      const patched = {
        ...previous,
        status: result.status,
        paymentStatus: result.paymentStatus ?? previous.paymentStatus,
      };
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
            <SkeletonDetail label="Loading request" />
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

  // One payment line for the Order Summary. Terminal orders are history —
  // they report nothing here (the transaction record and status card already
  // cover them, and a cancelled order must never be prompted to pay). Live
  // orders get an action hint per rail; a null method (legacy rows) falls
  // back to the rail-neutral label rather than being silently read as online.
  const paymentCaption = (() => {
    if (terminal) return null;
    if (order.paymentStatus === 'paid') return 'Paid in Send2U (simulated for this demo).';
    if (order.paymentStatus === 'collected') return 'Cash collected on delivery.';
    if (order.paymentStatus === 'refunded') return 'Refunded by Send2U.';
    if (order.paymentMethod === 'cod') {
      return 'Cash due on delivery — pay your helper when the food arrives.';
    }
    if (order.paymentMethod === 'online') {
      return 'Not paid yet — pay in Send2U when your order is ready.';
    }
    return paymentStatusLabel(order.paymentStatus, null);
  })();

  // Cancellation is possible while the kitchen has not committed — that
  // includes the vendor prep states. Past the purchase step, cancelling moves
  // the order to dispute for review (no food-cost liability: the helper never
  // pays for food). Records are always preserved, never deleted.
  const cancellable =
    !cancelled &&
    (order.status === 'pending' ||
      order.status === 'assigned' ||
      order.status === 'preparing' ||
      order.status === 'ready_for_pickup' ||
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

  // Note: no "Report an issue" overflow item — the delivered section owns
  // the inline report toggle, so a menu duplicate would be a second path to
  // the same form.
  const menuItems: { key: string; icon: keyof typeof MaterialIcons.glyphMap; title: string; onPress: () => void }[] =
    [];
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
          <View style={styles.headerText}>
            <Text variant="title" numberOfLines={2}>
              Request from {order.vendor.name}
            </Text>
            <Text variant="caption" color="secondary">
              #{order.id.slice(0, 8)} · Placed {formatOrderDate(order.createdAt)}
              {order.helperId ? ` · ${helperLabel(helperIdentity, order.helperId)}` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More actions"
            onPress={() => setMenuOpen((open) => !open)}
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
            hitSlop={8}>
            <MaterialIcons name="more-vert" size={22} color={colors.text} />
          </Pressable>
        </View>

        <RequestProgress order={order} />

        <View style={styles.statusBlock}>
          <Text variant="subtitle" style={{ color: STATUS_TONE_COLOR[card.tone] }}>
            {card.title}
          </Text>
          <Text color="secondary">{card.description}</Text>
        </View>

        <Card style={styles.card}>
          <Text variant="subtitle">Order Summary</Text>
          {order.vendor.locationHint ? (
            <Text variant="caption" color="secondary" numberOfLines={2}>
              {order.vendor.locationHint}
            </Text>
          ) : null}
          <OrderBreakdown
            items={order.items}
            subtotalCents={order.subtotalCents}
            deliveryFeeCents={order.deliveryFeeCents}
          />
          {paymentCaption ? (
            <Text variant="caption" color="muted">
              {paymentCaption}
            </Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text variant="subtitle">Drop-off Location</Text>
          <Text variant="secondary" numberOfLines={2}>
            {order.location.name}
          </Text>
        </Card>

        {isDelivered ? (
          <Card style={styles.card}>
            <Text variant="subtitle">Confirm receipt</Text>
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
                  Reporting moves the order to dispute for review. Paid online orders are
                  recorded as refunded when cancelled before completion (simulated).
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {!terminal ? <RequesterPaymentCard orderId={order.id} refreshToken={paymentTick} /> : null}

        {!terminal &&
        order.paymentMethod === 'online' &&
        (order.paymentStatus === 'pending' ||
          order.paymentStatus === 'failed' ||
          order.paymentStatus === 'unpaid') ? (
          <Button
            title="Continue to Payment"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/(requester)/orders/[id]/pay-online', params: { id: order.id } })
            }
          />
        ) : null}

        {showCancel ? (
          <Card style={styles.card}>
            <Button
              title={cancelOpen ? 'Hide cancellation' : 'Cancel this request'}
              variant="tertiary"
              onPress={() => setCancelOpen((open) => !open)}
            />
            {cancelOpen ? (
              <>
                {lateCancellable ? (
                  <Text color="secondary">
                    The kitchen may already be working on your food. Cancelling now sends
                    the order for review — you carry no food-cost debt.
                  </Text>
                ) : (
                  <Text color="secondary">
                    Free cancellation while the kitchen has not committed. A completed
                    online payment is recorded as refunded (simulated).
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
                  title={cancelling ? 'Cancelling…' : 'Cancel request'}
                  variant="danger"
                  onPress={() => void handleCancel()}
                  disabled={cancelling || reason.trim().length === 0}
                  loading={cancelling}
                />
              </>
            ) : null}
          </Card>
        ) : null}

        {terminal ? (
          <>
            <TransactionRecord orderId={order.id} />
            {order.status === 'completed' ? (
              <OrderRatingSection order={order} refreshToken={paymentTick} cardStyle={styles.card} />
            ) : null}
            {order.status === 'cancelled' || order.status === 'disputed' ? (
              <Card style={styles.card}>
                <Text variant="subtitle">What happened</Text>
                <OrderTimeline order={order} />
              </Card>
            ) : null}
            {order.disputeDetails ? (
              <Card style={styles.card}>
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
              <Card style={styles.card}>
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
            <View style={styles.actionRow}>
              <View style={styles.actionFill}>
                <Button title="Browse menu" onPress={() => router.push('/(requester)')} />
              </View>
              <View style={styles.actionFill}>
                <Button title="Need help?" variant="secondary" onPress={() => router.push('/(requester)/help')} />
              </View>
            </View>
          </>
        ) : null}
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerText: { flex: 1, gap: spacing.xs },
  statusBlock: { gap: spacing.xs },
  // Bordered, explicitly shadow-free card surface for detail sections.
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
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
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionFill: { flex: 1 },
});
