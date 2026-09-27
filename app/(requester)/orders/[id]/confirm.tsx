import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { goBackOr } from '@/lib/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { DockedActionBar } from '@/components/ui/DockedActionBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonDetail } from '@/components/ui/LoadingBlocks';
import { HeaderBack } from '@/components/HeaderBack';
import { RedScreen } from '@/components/RedScreen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { emitOrderChanged } from '@/lib/orderEvents';
import { formatMYR } from '@/lib/money';
import { orderItemsTitle, orderTotalCents } from '@/lib/orders';
import { confirmDelivery, getOrderDetail } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

const CHECKLIST = [
  'You have received the correct items.',
  'The food is in acceptable condition.',
  'Confirming finishes the handover — COD cash is due now if this is a cash order.',
  'This action cannot be undone.',
];

/**
 * Confirm Delivery: the guided checklist behind the requester's receipt
 * confirmation. Only `delivered` orders qualify; success patches the order
 * from the RPC's authoritative status and broadcasts it. When payment is
 * already resolved, confirmation completes the transaction with its
 * settlement. "Not yet" changes nothing.
 */
export default function OrderConfirmScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof id === 'string' ? id : null;

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const load = useCallback(
    async (background: boolean) => {
      if (!orderId) return;
      if (!background) {
        setStatus('loading');
        setLoadFailed(false);
      } else {
        setRefreshing(true);
      }
      try {
        const found = await getOrderDetail(orderId);
        setOrder(found);
        setLoadFailed(false);
        setStatus(found ? 'ready' : 'missing');
      } catch {
        if (!background) {
          setOrder(null);
          setLoadFailed(true);
          setStatus('missing');
        }
      } finally {
        setRefreshing(false);
      }
    },
    [orderId],
  );

  // Mount + retry fetch. Inlined rather than calling load(): a useEffect
  // body may not call a state-setting callback — state sets here live only
  // in the async continuation.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!orderId) return;
      try {
        const found = await getOrderDetail(orderId);
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
  }, [orderId, refreshToken]);

  // The order can move while this screen is mounted (helper/dispute flows
  // run elsewhere) — reconcile silently so the gate below never acts on a
  // stale status. Skipped on first mount: the mount fetch above already
  // covers it (same first-run guard pattern as the helper queue).
  const firstFocusRun = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRun.current) {
        firstFocusRun.current = false;
        return;
      }
      void load(true);
    }, [load]),
  );

  const handleConfirm = useCallback(async () => {
    if (!order || confirming || order.status !== 'delivered') return;
    const previous = order;
    setConfirming(true);
    setConfirmError(null);
    try {
      const result = await confirmDelivery(order.id);
      const patched = { ...previous, status: result.status };
      setOrder(patched);
      emitOrderChanged(patched);
      setConfirmed(true);
    } catch (err) {
      setOrder(previous);
      setConfirmError(err instanceof Error ? err.message : 'Could not confirm delivery.');
    } finally {
      setConfirming(false);
    }
  }, [order, confirming]);

  if (!orderId) {
    return (
      <RedScreen
        title="Confirm Delivery"
        titleSize="title"
        leading={<HeaderBack fallbackHref="/(requester)/orders" color={colors.onPrimary} />}>
        <ErrorState
          title="Request not found"
          message="This request isn't available to you."
          retryTitle="Back to requests"
          onRetry={() => router.push('/(requester)/orders')}
        />
      </RedScreen>
    );
  }

  const pastDelivery =
    order &&
    (order.status === 'confirmed' ||
      order.status === 'awaiting_requester_payment' ||
      order.status === 'completed');

  return (
    <RedScreen
      title="Confirm Delivery"
      titleSize="title"
      leading={
        <HeaderBack
          fallbackHref={orderId ? `/(requester)/orders/${orderId}` : '/(requester)/orders'}
          color={colors.onPrimary}
        />
      }
      scrollable={false}
      contentStyle={styles.shell}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {status === 'loading' || !order ? (
          status === 'loading' ? (
            <SkeletonDetail label="Loading request" />
          ) : loadFailed ? (
            <ErrorState
              title="Couldn't load the request"
              message="Check your connection and try again."
              retryTitle="Try again"
              onRetry={() => setRefreshToken((t) => t + 1)}
            />
          ) : (
            <ErrorState
              title="Request not found"
              message="This request isn't available to you."
              retryTitle="Back to requests"
              onRetry={() => router.push('/(requester)/orders')}
            />
          )
        ) : confirmed || pastDelivery ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroCircle}>
                <MaterialIcons
                  name="check"
                  size={44}
                  color={colors.success}
                  accessibilityLabel="Delivery confirmed"
                />
              </View>
              <Text variant="title" style={styles.centered}>
                Delivery confirmed
              </Text>
              <Text color="secondary" style={styles.centered}>
                {order.paymentMethod === 'cod'
                  ? order.paymentStatus === 'collected'
                    ? 'Cash recorded by Send2U — your request is complete.'
                    : 'Hand the cash to your helper — Send2U records the collection to finish the request.'
                  : order.paymentStatus === 'paid'
                    ? 'Payment already recorded — your request is complete.'
                    : 'Finish your online payment to complete the request.'}
              </Text>
            </View>
            {order.paymentMethod === 'online' &&
            order.paymentStatus !== 'paid' &&
            order.paymentStatus !== 'refunded' ? (
              <Button
                title="Continue to Payment"
                onPress={() =>
                  router.push({
                    pathname: '/(requester)/orders/[id]/pay-online',
                    params: { id: orderId },
                  })
                }
              />
            ) : null}
            <Button
              title="Back to Request"
              variant="secondary"
              onPress={() =>
                goBackOr(
                  orderId
                    ? { pathname: '/(requester)/orders/[id]', params: { id: orderId } }
                    : '/(requester)/orders',
                )
              }
            />
          </>
        ) : order.status !== 'delivered' ? (
          <EmptyState
            icon="schedule"
            title="Not ready to confirm"
            message="Confirmation opens once the helper marks your food delivered."
            actionTitle="Back to request"
            onAction={() =>
              goBackOr(
                orderId
                  ? { pathname: '/(requester)/orders/[id]', params: { id: orderId } }
                  : '/(requester)/orders',
              )
            }
          />
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.heroCircle}>
                <MaterialIcons
                  name="shopping-bag"
                  size={44}
                  color={colors.primary}
                  accessibilityLabel="Delivered order"
                />
              </View>
              <Text variant="title" style={styles.centered}>
                Have you received your order?
              </Text>
              <Text color="secondary" style={styles.centered}>
                Please confirm only when you have received your food in good condition.
              </Text>
              <Text variant="caption" color="muted" style={styles.centered}>
                Confirming is optional and never blocks your order.
              </Text>
            </View>

            <Text variant="subtitle">Order Summary</Text>
            <View>
              <View style={styles.row}>
                <MaterialIcons name="storefront" size={20} color={colors.primary} />
                <Text variant="secondary" style={styles.rowText} numberOfLines={2}>
                  {order.vendor.name}
                </Text>
                <Text variant="secondary" style={styles.rowTotal}>
                  {formatMYR(orderTotalCents(order.subtotalCents, order.deliveryFeeCents))}
                </Text>
              </View>
              <Text color="secondary" numberOfLines={3}>
                {orderItemsTitle(order.items)}
              </Text>
              <View style={styles.row}>
                <MaterialIcons name="place" size={20} color={colors.error} />
                <Text variant="secondary" style={styles.rowText} numberOfLines={2}>
                  {order.location.name}
                </Text>
              </View>
            </View>

            <View>
              <View style={styles.checkTitle}>
                <MaterialIcons name="error" size={22} color={colors.error} />
                <Text variant="secondary" style={styles.checkHeading}>
                  By confirming, you agree that:
                </Text>
              </View>
              {CHECKLIST.map((line) => (
                <View key={line} style={styles.checkLine}>
                  <MaterialIcons name="check" size={18} color={colors.error} />
                  <Text color="secondary" style={styles.checkText}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>

            {refreshing ? (
              <View style={styles.refreshRow}>
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  accessibilityLabel="Checking request status…"
                />
                <Text variant="caption" color="secondary">
                  Checking request status…
                </Text>
              </View>
            ) : null}
            {confirmError ? (
              <ErrorState
                title="Could not confirm"
                message={confirmError}
                retryTitle="Dismiss"
                onRetry={() => setConfirmError(null)}
              />
            ) : null}
            <Button
              title="Not Yet, Still Waiting"
              variant="secondary"
              disabled={confirming}
              onPress={() =>
                goBackOr(
                  orderId
                    ? { pathname: '/(requester)/orders/[id]', params: { id: orderId } }
                    : '/(requester)/orders',
                )
              }
            />
          </>
        )}
        </ScrollView>
        {/* Fixed bottom sheet: Confirm stays docked while the checklist
            scrolls. "Not yet" stays inline — it is the escape hatch, not
            the action. */}
        {order && !confirmed && !pastDelivery && order.status === 'delivered' ? (
          <DockedActionBar>
            <Button
              title={confirming ? 'Confirming…' : 'Confirm Delivery'}
              onPress={() => void handleConfirm()}
              disabled={confirming || refreshing}
              loading={confirming}
            />
          </DockedActionBar>
        ) : null}
    </RedScreen>
  );
}

const styles = StyleSheet.create({
  // Shell drops the scroll container's own padding: the inner scroll view
  // owns horizontal rhythm and the docked bar owns the bottom edge.
  shell: { flex: 1, paddingHorizontal: 0, paddingBottom: 0, gap: 0 },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  heroCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  centered: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, fontWeight: '600', color: colors.text },
  rowTotal: { fontWeight: '700', color: colors.primary },
  checkTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkHeading: { fontWeight: '600', color: colors.text },
  checkLine: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkText: { flex: 1 },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
