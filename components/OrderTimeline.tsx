import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { formatOrderDate } from '@/lib/orders';
import { formatMYR } from '@/lib/money';
import type { OrderWithDetails } from '@/types/domain';

interface TimelineEvent {
  key: string;
  label: string;
  at: string | null;
  detail?: string;
  terminal?: boolean;
}

/** Ordered fulfilment events that actually happened (null timestamps omitted). */
function buildEvents(order: OrderWithDetails): TimelineEvent[] {
  return [
    { key: 'placed', label: 'Request placed', at: order.createdAt },
    {
      key: 'accepted',
      label: order.helperId ? `Helper accepted` : 'Waiting for helper',
      at: order.acceptedAt,
      detail: order.helperId ? `Helper ${order.helperId.slice(0, 8)}…` : undefined,
    },
    { key: 'going', label: 'Helper heading to vendor', at: order.goingToVendorAt },
    { key: 'arrived', label: 'Helper arrived at vendor', at: order.arrivedAt },
    { key: 'available', label: 'Food confirmed available', at: order.foodAvailableAt },
    {
      key: 'purchased',
      label: 'Food secured (covered by Send2U)',
      at: order.purchasedAt,
      detail:
        order.foodCostCents !== null
          ? `${formatMYR(order.foodCostCents)} covered by Send2U`
          : undefined,
    },
    { key: 'picked_up', label: 'Food picked up', at: order.pickedUpAt },
    { key: 'out_for_delivery', label: 'Out for delivery', at: order.outForDeliveryAt },
    { key: 'delivered', label: 'Delivered', at: order.deliveredAt },
    { key: 'confirmed', label: 'Delivery confirmed by requester', at: order.confirmedAt },
    {
      key: 'cancelled',
      label: 'Cancelled',
      at: order.cancelledAt,
      detail: order.cancelReason ?? undefined,
      terminal: true,
    },
    {
      key: 'disputed',
      label: 'Marked as disputed',
      at: order.disputedAt,
      detail: order.disputeReason ?? undefined,
      terminal: true,
    },
    {
      key: 'resolved',
      label: order.resolution ? `Dispute settled as ${order.resolution}` : 'Dispute settled',
      at: order.resolvedAt,
      terminal: true,
    },
  ].filter((event) => event.at !== null);
}

/**
 * Read-only lifecycle timeline for historical orders. Shows only events
 * with real timestamps — never invents steps that did not happen.
 */
export function OrderTimeline({ order }: { order: OrderWithDetails }) {
  const events = buildEvents(order);
  return (
    <View style={styles.list} accessibilityRole="summary">
      {events.map((event) => (
        <View key={event.key} style={styles.row}>
          <View style={[styles.dot, event.terminal && styles.dotTerminal]} />
          <View style={styles.textBlock}>
            <Text variant="secondary" style={styles.label}>
              {event.label}
            </Text>
            {event.detail ? (
              <Text variant="caption" color="secondary">
                {event.detail}
              </Text>
            ) : null}
            {event.at ? (
              <Text variant="caption" color="muted">
                {formatOrderDate(event.at)}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  dotTerminal: { backgroundColor: colors.muted },
  textBlock: { flex: 1, gap: 2 },
  label: { fontWeight: '600', color: colors.text },
});
