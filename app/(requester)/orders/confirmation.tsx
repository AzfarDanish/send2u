import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { CopyButton } from '@/components/CopyButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonDetail } from '@/components/ui/LoadingBlocks';
import { ListRow } from '@/components/ui/ListRow';
import { GlassHeader } from '@/components/GlassHeader';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { formatMYR } from '@/lib/money';
import {
  orderItemsTitle,
  orderStatusTone,
  orderTotalCents,
  requesterStatusMessage,
} from '@/lib/orders';
import { getOrderDetail } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Request Submitted confirmation. Opens immediately after a successful
 * submit with the real just-created orders (fetched by ID — never
 * params-carried snapshots), so the ID, status, summary, and drop-off
 * shown here always match the backend. "View Request" pushes the full
 * Request Detail, preserving back-to-confirmation history.
 */
export default function OrderConfirmationScreen() {
  const { orderIds } = useLocalSearchParams<{ orderIds?: string }>();
  const ids =
    typeof orderIds === 'string' && orderIds.length > 0
      ? [...new Set(orderIds.split(',').filter((id) => id.length > 0))]
      : [];

  const [orders, setOrders] = useState<OrderWithDetails[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    try {
      const found = (
        await Promise.all(ids.map((id) => getOrderDetail(id).catch(() => null)))
      ).filter((order): order is OrderWithDetails => order !== null);
      setOrders(found);
      setLoadFailed(false);
      setStatus(found.length > 0 ? 'ready' : 'missing');
    } catch {
      // Transient failure: keep the last good render; retry paths reconcile.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIds, retryToken]);

  // Stay accurate if a helper accepts while this screen is mounted.
  useRealtimeReload(
    ids.flatMap((id) => [
      { table: 'send2u_orders', filter: `id=eq.${id}` },
      { table: 'send2u_payments', filter: `order_id=eq.${id}` },
      { table: 'send2u_ratings', filter: `order_id=eq.${id}` },
    ]),
    () => {
      void reload();
    },
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const found = (
          await Promise.all(ids.map((id) => getOrderDetail(id).catch(() => null)))
        ).filter((order): order is OrderWithDetails => order !== null);
        if (mounted) {
          setOrders(found);
          setLoadFailed(false);
          setStatus(found.length > 0 ? 'ready' : 'missing');
        }
      } catch {
        if (mounted) {
          setOrders(null);
          setLoadFailed(true);
          setStatus('missing');
        }
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIds, retryToken]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  if (status === 'loading' || !orders) {
    return (
      <>
        <GlassHeader title="Request Submitted" />
        <Screen beneathHeader>
          {status === 'loading' ? (
            <SkeletonDetail label="Confirming your request" />
          ) : loadFailed ? (
            <ErrorState
              title="Couldn't load the confirmation"
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
              title="Nothing to confirm"
              message="These requests aren't available to you. Check Requests for your orders."
              retryTitle="View Requests"
              onRetry={() => router.push('/(requester)/orders')}
            />
          )}
        </Screen>
      </>
    );
  }

  const single = orders.length === 1 ? orders[0] : null;
  const locationName = orders[0]?.location.name ?? null;
  const allPending = orders.every((order) => order.status === 'pending');
  const anyAssigned = orders.some(
    (order) => order.status === 'assigned' || order.status === 'accepted',
  );

  return (
    <>
      <GlassHeader title="Request Submitted" />
      <Screen beneathHeader
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
        }>
        <View style={styles.hero}>
          <View style={styles.heroCircle}>
            <MaterialIcons name="send" size={44} color={colors.primary} accessibilityLabel="Request sent" />
          </View>
          <Text variant="title" style={styles.heroTitle}>
            Request Submitted!
          </Text>
          <Text color="secondary" style={styles.heroSubtitle}>
            {single && single.paymentMethod === 'cod'
              ? `Pay ${formatMYR(orderTotalCents(single.subtotalCents, single.deliveryFeeCents))} in cash when your food arrives — Send2U records the collection.`
              : single && single.paymentMethod === 'online' && single.paymentStatus !== 'paid'
                ? 'Complete your online payment below to fire the kitchen.'
                : 'Your request has been sent to available helpers. We\u2019ll notify you once a helper accepts it.'}
          </Text>
        </View>

        <View style={styles.idCard}>
          <View style={styles.idHeader}>
            <MaterialIcons name="receipt-long" size={20} color={colors.primary} />
            <Text variant="caption" color="secondary">
              Request ID{orders.length === 1 ? '' : 's'}
            </Text>
          </View>
          {orders.map((order) => (
            <View key={order.id} style={styles.idRow}>
              <Text variant="subtitle" numberOfLines={1} ellipsizeMode="tail" style={styles.idText}>
                #{order.id.slice(0, 8)}
              </Text>
              <CopyButton
                value={`#${order.id.slice(0, 8)}`}
                accessibilityLabel={`Copy request ID ${order.id.slice(0, 8)}`}
              />
            </View>
          ))}
        </View>

        <View style={styles.statusCard}>
          <MaterialIcons
            name={anyAssigned ? 'person-outline' : 'schedule'}
            size={28}
            color={allPending || anyAssigned ? colors.info : colors.warning}
          />
          <View style={styles.statusText}>
            {allPending ? (
              <>
                <Text variant="subtitle" style={{ color: colors.info }}>
                  Waiting for Helper
                </Text>
                <Text color="secondary">We&rsquo;re finding a helper for you.</Text>
              </>
            ) : anyAssigned ? (
              <>
                <Text variant="subtitle" style={{ color: colors.info }}>
                  Helper assigned
                </Text>
                <Text color="secondary">
                  A helper accepted your request. Open it to follow along.
                </Text>
              </>
            ) : (
              <>
                <Badge
                  label={requesterStatusMessage(orders[0].status)}
                  tone={orderStatusTone(orders[0].status)}
                />
                <Text color="secondary">Your request is already on its way.</Text>
              </>
            )}
          </View>
        </View>

        <Text variant="subtitle">Order Summary</Text>
        {single ? (
          <Card>
            <View style={styles.row}>
              <MaterialIcons name="storefront" size={20} color={colors.primary} />
              <View style={styles.rowText}>
                <Text variant="secondary" style={styles.vendorName} numberOfLines={2}>
                  {single.vendor.name}
                </Text>
                {single.vendor.locationHint ? (
                  <Text variant="caption" color="secondary" numberOfLines={2}>
                    {single.vendor.locationHint}
                  </Text>
                ) : null}
              </View>
            </View>
            <Text color="secondary" numberOfLines={2}>
              {orderItemsTitle(single.items)}
            </Text>
            <View style={styles.summaryRow}>
              <Text color="secondary">Total</Text>
              <Text variant="price" style={styles.summaryTotal}>
                {formatMYR(orderTotalCents(single.subtotalCents, single.deliveryFeeCents))}
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={styles.listCard}>
            {orders.map((order) => (
              <ListRow
                key={order.id}
                icon="receipt-long"
                title={order.vendor.name}
                subtitle={`#${order.id.slice(0, 8)} · ${orderItemsTitle(order.items)}`}
                onPress={() =>
                  router.push({ pathname: '/(requester)/orders/[id]', params: { id: order.id } })
                }
                right={
                  <Text variant="secondary" style={styles.rowTotal}>
                    {formatMYR(orderTotalCents(order.subtotalCents, order.deliveryFeeCents))}
                  </Text>
                }
              />
            ))}
          </Card>
        )}

        <Text variant="subtitle">Drop-off Location</Text>
        <Card>
          <View style={styles.row}>
            <MaterialIcons name="place" size={20} color={colors.error} />
            <Text variant="secondary" style={styles.rowText} numberOfLines={2}>
              {locationName ?? 'Drop-off location not set'}
            </Text>
          </View>
        </Card>

        {single ? (
          <Button
            title="View Request"
            onPress={() => {
              // One-time confirmation: step back to the origin first so the
              // confirmation leaves history — Back from detail returns to
              // the menu, never to this screen.
              if (router.canGoBack()) router.back();
              router.push({ pathname: '/(requester)/orders/[id]', params: { id: single.id } });
            }}
          />
        ) : (
          <>
            <Button title="View Requests" onPress={() => router.push('/(requester)/orders')} />
            {orders.some(
              (order) =>
                order.paymentMethod === 'online' &&
                (order.paymentStatus === 'pending' ||
                  order.paymentStatus === 'failed' ||
                  order.paymentStatus === 'unpaid'),
            ) ? (
              <Text variant="caption" color="secondary" style={styles.heroSubtitle}>
                Open each request to complete its online payment — the kitchen fires per order.
              </Text>
            ) : null}
          </>
        )}
        {single &&
        single.paymentMethod === 'online' &&
        (single.paymentStatus === 'pending' ||
          single.paymentStatus === 'failed' ||
          single.paymentStatus === 'unpaid') ? (
          <Button
            title={`Pay ${formatMYR(orderTotalCents(single.subtotalCents, single.deliveryFeeCents))}`}
            variant="secondary"
            onPress={() => {
              if (router.canGoBack()) router.back();
              router.push({
                pathname: '/(requester)/orders/[id]/pay-online',
                params: { id: single.id },
              });
            }}
          />
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  heroCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroTitle: { textAlign: 'center' },
  heroSubtitle: { textAlign: 'center' },
  idCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  idHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  idText: { flex: 1 },
  statusCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.infoSoft,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  statusText: { flex: 1, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, fontWeight: '600', color: colors.text },
  vendorName: { fontWeight: '600', color: colors.text },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  summaryTotal: { fontVariant: ['tabular-nums'] as const },
  rowTotal: { fontWeight: '700', color: colors.primary },
  listCard: { gap: 0 },
});
