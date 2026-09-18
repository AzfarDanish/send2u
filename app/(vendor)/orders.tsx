import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useVendorOrders } from '@/hooks/useVendorOrders';
import { formatMYR } from '@/lib/money';
import { orderItemsTitle, paymentMethodLabel } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/** Whether Send2U has cleared this order for preparation. */
function prepState(order: OrderWithDetails): 'ready' | 'waiting_payment' | 'done' {
  if (order.paymentMethod === 'online' && order.paymentStatus !== 'paid') return 'waiting_payment';
  if (order.status === 'pending' || order.status === 'assigned') return 'ready';
  return 'done';
}

/**
 * Vendor Orders tab: the stall's prep queue. Paid online orders and COD
 * orders appear here with items, quantities, and the food amount. The vendor
 * progresses preparation (pending/assigned → preparing → ready for pickup);
 * the helper only collects the food — never pays for it.
 */
export default function VendorOrdersScreen() {
  const {
    orders,
    status,
    error,
    refreshing,
    retry,
    refresh,
    advancing,
    advanceError,
    advance,
    dismissAdvanceError,
  } = useVendorOrders();

  const openOrder = (order: OrderWithDetails) => {
    router.push({ pathname: '/(vendor)/orders/[id]', params: { id: order.id } });
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }>
      <SectionHeader eyebrow="Orders" title="Prep queue" />
      {advanceError ? (
        <ErrorState
          title="Couldn't update preparation"
          message={advanceError}
          retryTitle="Dismiss"
          onRetry={dismissAdvanceError}
        />
      ) : null}
      {status === 'loading' ? (
        <SkeletonList rows={3} lines={3} thumb={0} trailing label="Loading stall orders" />
      ) : null}
      {status === 'error' ? (
        <ErrorState
          title="Couldn't load orders"
          message={error ?? 'Check your connection and try again.'}
          retryTitle="Try again"
          onRetry={retry}
        />
      ) : null}
      {status === 'empty' ? (
        <EmptyState
          icon="restaurant-menu"
          title="No orders yet"
          message="Paid online orders and COD orders for your stall appear here."
        />
      ) : null}
      {status === 'ready'
        ? orders.map((order, index) => {
            const state = prepState(order);
            const busy = advancing === order.id;
            return (
              <View key={order.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${orderItemsTitle(order.items)}`}
                  onPress={() => openOrder(order)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <View style={styles.middle}>
                    <Text variant="secondary" style={styles.title} numberOfLines={2}>
                      {orderItemsTitle(order.items)}
                    </Text>
                    <Text variant="caption" color="secondary" numberOfLines={1}>
                      {paymentMethodLabel(order.paymentMethod)} ·{' '}
                      {state === 'waiting_payment'
                        ? 'waiting for payment'
                        : order.paymentMethod === 'cod' && order.paymentStatus !== 'collected'
                          ? 'COD — cash on delivery'
                          : order.status === 'preparing'
                            ? 'preparing'
                            : order.status === 'ready_for_pickup'
                              ? 'ready for pickup'
                              : order.helperId
                                ? 'helper assigned'
                                : 'new order'}
                    </Text>
                    <Text variant="caption" color="secondary" numberOfLines={1}>
                      Food {formatMYR(order.subtotalCents)}
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text variant="price" style={styles.amount}>
                      {formatMYR(order.subtotalCents)}
                    </Text>
                  </View>
                </Pressable>
                {(state === 'ready' &&
                  (order.status === 'pending' || order.status === 'assigned')) ||
                order.status === 'preparing' ? (
                  <View style={styles.actionWrap}>
                    <Button
                      title={
                        busy
                          ? 'Working…'
                          : order.status === 'preparing'
                            ? 'Mark ready for pickup'
                            : 'Start preparing'
                      }
                      variant="secondary"
                      onPress={() =>
                        void advance(
                          order.id,
                          order.status === 'preparing' ? 'mark_ready' : 'start_preparing',
                        )
                      }
                      disabled={busy}
                      loading={busy}
                    />
                  </View>
                ) : null}
                {index === orders.length - 1 ? null : <View style={styles.divider} />}
              </View>
            );
          })
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontWeight: '600', color: colors.text },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  amount: { fontWeight: '700', color: colors.primary, fontVariant: ['tabular-nums'] as const },
  actionWrap: { paddingBottom: spacing.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
});
