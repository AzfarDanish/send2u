import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { OrderTimeline } from '@/components/OrderTimeline';
import { ReceiptEvidenceView } from '@/components/ReceiptEvidenceView';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, paymentStatusLabel, paymentStatusTone } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Read-only historical order for the requester. Informative only: outcome,
 * items, pricing, helper, timeline, and payment record. Deliberately renders
 * zero buttons/inputs that could mutate the order — cancelling, paying,
 * and receipt submission all live on the active detail screen.
 */
export function RequesterHistoryDetail({ order }: { order: OrderWithDetails }) {
  const totalCents = order.subtotalCents + order.deliveryFeeCents;

  return (
    <View style={styles.container}>
      <Card>
        <Badge label="History · read-only" tone="neutral" />
        {order.status === 'completed' ? (
          <>
            <Badge label="Completed" tone="success" />
            <Text variant="subtitle">Delivered and paid</Text>
            <Text color="secondary">
              Placed {formatOrderDate(order.createdAt)}
              {order.deliveredAt ? ` · delivered ${formatOrderDate(order.deliveredAt)}` : ''}.
              Thanks for using Send2U — this record is kept for your receipts.
            </Text>
          </>
        ) : order.status === 'cancelled' ? (
          <>
            <Badge label="Cancelled" tone="error" />
            <Text variant="subtitle">This order was cancelled</Text>
            <Text color="secondary">
              {order.cancelReason === 'food_unavailable'
                ? 'The stall had no food, so this order was stopped. You owe nothing.'
                : `Cancelled${order.cancelReason ? `: ${order.cancelReason}` : ''}.`}
              {order.cancelledAt ? ` (${formatOrderDate(order.cancelledAt)})` : ''}
            </Text>
          </>
        ) : (
          <>
            <Badge
              label={order.resolvedAt ? `Settled · ${order.resolution ?? 'resolved'}` : 'Needs settlement'}
              tone="error"
            />
            <Text variant="subtitle">This order needs settling up</Text>
            <Text color="secondary">
              {order.disputeReason === 'late_cancellation'
                ? `You cancelled after the helper had already paid ${order.foodCostCents ? formatMYR(order.foodCostCents) : 'for the food'}. Settle the food cost with your helper directly — Send2U never moves money itself.`
                : order.disputeReason === 'delivery_failed'
                  ? 'The delivery could not be completed. Settle any food cost with your helper directly.'
                  : 'This order is under review.'}
              {order.disputedAt ? ` (flagged ${formatOrderDate(order.disputedAt)})` : ''}
              {order.resolvedAt
                ? ` Settled${order.resolution ? ` as ${order.resolution}` : ''} on ${formatOrderDate(order.resolvedAt)}.`
                : ''}
            </Text>
          </>
        )}
      </Card>

      <Card>
        <View style={styles.heading}>
          <Text variant="title">{order.vendor.name}</Text>
        </View>
        <Text variant="caption" color="secondary">
          Placed {formatOrderDate(order.createdAt)} · Pickup ref {order.pickupCode}
        </Text>
        <View style={styles.row}>
          <MaterialIcons name="place" size={20} color={colors.primary} />
          <Text variant="secondary" style={styles.rowText}>
            {order.location.name}
          </Text>
        </View>
        <Text variant="caption" color="muted">
          {order.vendor.locationHint ?? 'Campus vendor'}
        </Text>
        <Text variant="caption" color="muted">
          {order.helperId
            ? `Delivered by helper ${order.helperId.slice(0, 8)}…${order.acceptedAt ? ` · accepted ${formatOrderDate(order.acceptedAt)}` : ''}`
            : 'No helper was assigned to this order.'}
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
        <View style={styles.moneyRow}>
          <Text color="secondary">Food subtotal</Text>
          <Text variant="subtitle">{formatMYR(order.subtotalCents)}</Text>
        </View>
        <View style={styles.moneyRow}>
          <Text color="secondary">Delivery fee</Text>
          <Text variant="subtitle">{formatMYR(order.deliveryFeeCents)}</Text>
        </View>
        <View style={styles.moneyRow}>
          <Text variant="subtitle">Order total</Text>
          <Text variant="title" color="primary">
            {formatMYR(totalCents)}
          </Text>
        </View>
        {order.status === 'cancelled' && order.cancelReason === 'food_unavailable' ? (
          <Text variant="caption" color="muted">
            No payment was due — the order stopped before any money changed hands.
          </Text>
        ) : (
          <Text variant="caption" color="muted">
            Historical total for your records. No payment action is available here.
          </Text>
        )}
      </Card>

      <Card>
        <Text variant="subtitle">What happened</Text>
        <OrderTimeline order={order} />
      </Card>

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
            <Text variant="caption" color="muted">
              Receipt kept for disputes and accounting. Nothing further to do.
            </Text>
          </>
        ) : (
          <Text color="secondary">
            {order.status === 'completed'
              ? 'No payment record was stored for this order.'
              : 'No payment was submitted for this order.'}
          </Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, fontWeight: '600', color: colors.text },
  itemsCard: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  lineText: { flex: 1, gap: spacing.xs },
  lineName: { fontWeight: '600', color: colors.text },
  lineTotal: { fontWeight: '700', color: colors.primary },
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
