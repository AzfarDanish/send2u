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
 * Read-only historical delivery for the helper. Shows the final outcome,
 * route, requester, items, fronted food cost vs delivery earning, timeline,
 * and payment record. Renders no accept/advance/verify actions — those live
 * on the active job screen only.
 */
export function HelperHistoryDetail({ job }: { job: OrderWithDetails }) {
  return (
    <View style={styles.container}>
      <Card>
        <Badge label="History · read-only" tone="neutral" />
        {job.status === 'completed' ? (
          <>
            <Badge label="Completed" tone="success" />
            <Text variant="subtitle">Delivery complete</Text>
            <Text color="secondary">
              Payment verified. Your {formatMYR(job.deliveryFeeCents)} delivery earning is
              finalized
              {job.deliveredAt ? ` · delivered ${formatOrderDate(job.deliveredAt)}` : ''}.
            </Text>
          </>
        ) : job.status === 'cancelled' ? (
          <>
            <Badge label="Cancelled" tone="error" />
            <Text variant="subtitle">This job was cancelled</Text>
            <Text color="secondary">
              {job.cancelReason === 'food_unavailable'
                ? 'The food was unavailable — no money changed hands.'
                : `Cancelled${job.cancelReason ? `: ${job.cancelReason}` : ''}.`}
              {job.cancelledAt ? ` (${formatOrderDate(job.cancelledAt)})` : ''}
            </Text>
          </>
        ) : (
          <>
            <Badge
              label={job.resolvedAt ? `Settled · ${job.resolution ?? 'resolved'}` : 'Disputed'}
              tone="error"
            />
            <Text variant="subtitle">This delivery needs settlement</Text>
            <Text color="secondary">
              {job.foodCostCents
                ? `Your fronted ${formatMYR(job.foodCostCents)} is recorded. `
                : ''}
              An admin will resolve it; nothing more to do here.
              {job.disputedAt ? ` (flagged ${formatOrderDate(job.disputedAt)})` : ''}
              {job.resolvedAt
                ? ` Settled${job.resolution ? ` as ${job.resolution}` : ''} on ${formatOrderDate(job.resolvedAt)}.`
                : ''}
            </Text>
          </>
        )}
      </Card>

      <Card>
        <View style={styles.heading}>
          <Text variant="title">{job.vendor.name}</Text>
        </View>
        <Text variant="caption" color="secondary">
          Requested {formatOrderDate(job.createdAt)}
          {job.acceptedAt ? ` · you accepted ${formatOrderDate(job.acceptedAt)}` : ''}
        </Text>
        <View style={styles.row}>
          <MaterialIcons name="storefront" size={20} color={colors.primary} />
          <View style={styles.rowText}>
            <Text variant="secondary" style={styles.placeName}>
              Picked up here
            </Text>
            {job.vendor.locationHint ? (
              <Text variant="caption" color="secondary">
                {job.vendor.locationHint}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.row}>
          <MaterialIcons name="place" size={20} color={colors.primary} />
          <View style={styles.rowText}>
            <Text variant="secondary" style={styles.placeName}>
              Dropped off at {job.location.name}
            </Text>
          </View>
        </View>
        <Text variant="caption" color="muted">
          Requester {job.requesterId.slice(0, 8)}… · Pickup ref {job.pickupCode}
        </Text>
      </Card>

      <Card style={styles.itemsCard}>
        {job.items.map((item) => (
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
          <Text variant="subtitle">{formatMYR(job.subtotalCents)}</Text>
        </View>
        <View style={styles.moneyRow}>
          <Text color="secondary">Food you fronted</Text>
          <Text variant="subtitle">
            {job.foodCostCents !== null ? formatMYR(job.foodCostCents) : '—'}
          </Text>
        </View>
        <View style={styles.moneyRow}>
          <Text variant="subtitle">Delivery earning</Text>
          <Text variant="title" color="primary">
            {formatMYR(job.deliveryFeeCents)}
          </Text>
        </View>
        <Text variant="caption" color="muted">
          Food you paid at the stall is an expense, not earnings — only the delivery fee counts
          as your payout.
        </Text>
      </Card>

      <Card>
        <Text variant="subtitle">What happened</Text>
        <OrderTimeline order={job} />
      </Card>

      <Card>
        <View style={styles.moneyRow}>
          <Text variant="subtitle">Payment record</Text>
          {job.payment ? (
            <Badge label={paymentStatusLabel(job.payment.status)} tone={paymentStatusTone(job.payment.status)} />
          ) : (
            <Badge label="No payment" tone="neutral" />
          )}
        </View>
        {job.payment ? (
          <>
            <Text color="secondary">
              {formatMYR(job.payment.amountCents)} receipt · submitted{' '}
              {formatOrderDate(job.payment.submittedAt)}
              {job.payment.verifiedAt
                ? ` · reviewed ${formatOrderDate(job.payment.verifiedAt)}`
                : ''}
              .
            </Text>
            <ReceiptEvidenceView path={job.payment.evidencePath} />
            <Text variant="caption" color="muted">
              Receipt kept for disputes and accounting. No verification action is available here.
            </Text>
          </>
        ) : (
          <Text color="secondary">
            {job.status === 'completed'
              ? 'No payment record was stored for this delivery.'
              : 'No receipt was submitted for this delivery.'}
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
  rowText: { flex: 1, gap: spacing.xs },
  placeName: { fontWeight: '600', color: colors.text },
  itemsCard: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  lineText: { flex: 1, gap: spacing.xs },
  lineName: { fontWeight: '600', color: colors.text },
  lineTotal: { fontWeight: '700', color: colors.primary },
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
