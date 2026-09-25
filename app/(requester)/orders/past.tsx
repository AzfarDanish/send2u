import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, touchTargets } from '@/constants/theme';
import { useMyOrderHistory } from '@/hooks/useMyOrderHistory';
import { formatMYR } from '@/lib/money';
import {
  formatOrderDate,
  orderItemsTitle,
  orderStatusLabel,
  orderStatusTone,
  orderTotalCents,
} from '@/lib/orders';
import type { OrderStatus, OrderWithDetails } from '@/types/domain';

/**
 * The requester's finished orders. My Orders shows active work only, so the
 * terminal records (completed / cancelled / disputed) live here, entered from
 * Profile. Same query and rows the Active/History split used before — the
 * Active list can never leak a finished order, and vice versa.
 */
export default function PastOrdersScreen() {
  const { orders, status, error, refreshing, retry, refresh } = useMyOrderHistory();

  return (
    <>
      <GlassHeader title="Past orders" fallbackHref="/(requester)/profile" />
      <Screen
        beneathHeader
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }>
        {status === 'loading' ? (
          <SkeletonList rows={4} lines={2} thumb={44} label="Loading past orders" />
        ) : null}
        {status === 'error' ? (
          <ErrorState
            title="Couldn't load past orders"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        ) : null}
        {status === 'empty' ? (
          <EmptyState
            icon="history"
            title="No past orders yet"
            message="Delivered, cancelled, and disputed requests are kept here."
            actionTitle="Browse the menu"
            onAction={() => router.push('/(requester)')}
          />
        ) : null}
        {status === 'ready'
          ? orders.map((order, index) => (
              <View key={order.id} style={index < orders.length - 1 ? styles.divider : undefined}>
                <PastOrderRow order={order} />
              </View>
            ))
          : null}
      </Screen>
    </>
  );
}

/**
 * The timestamp that actually closed the order: confirmation for completed,
 * cancellation for cancelled, the raised issue for disputed. Never a
 * synthesised date — a missing terminal stamp falls back to when the request
 * was placed.
 */
function closedAt(order: OrderWithDetails): string {
  if (order.status === 'completed') return order.confirmedAt ?? order.deliveredAt ?? order.createdAt;
  if (order.status === 'cancelled') return order.cancelledAt ?? order.createdAt;
  if (order.status === 'disputed') return order.disputedAt ?? order.createdAt;
  return order.createdAt;
}

const TONE_TEXT: Record<ReturnType<typeof orderStatusTone>, string> = {
  info: colors.info,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  neutral: colors.secondary,
};

const STATUS_ICONS: Partial<Record<OrderStatus, keyof typeof MaterialIcons.glyphMap>> = {
  completed: 'check-circle-outline',
  cancelled: 'cancel',
  disputed: 'report-problem',
};

function PastOrderRow({ order }: { order: OrderWithDetails }) {
  const title = orderItemsTitle(order.items);
  const label = orderStatusLabel(order.status);
  const closed = formatOrderDate(closedAt(order));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title} from ${order.vendor.name}. ${label} ${closed}.`}
      haptic="selection"
      style={styles.row}
      onPress={() => router.push({ pathname: '/(requester)/orders/[id]', params: { id: order.id } })}>
      <View style={styles.thumb}>
        <MaterialIcons
          name={STATUS_ICONS[order.status] ?? 'receipt-long'}
          size={22}
          color={colors.primary}
        />
      </View>
      <View style={styles.text}>
        <Text variant="secondary" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={1}>
          {order.vendor.name}
        </Text>
        <Text variant="caption" style={{ color: TONE_TEXT[orderStatusTone(order.status)] }}>
          {`${label} · ${closed}`}
        </Text>
      </View>
      <Text variant="caption" color="secondary">
        {formatMYR(orderTotalCents(order.subtotalCents, order.deliveryFeeCents))}
      </Text>
      <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTargets.listRow,
    paddingVertical: spacing.md,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: { fontWeight: '600' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
});
