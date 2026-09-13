import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrderRatingSection } from '@/components/OrderRatingSection';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { OrderTimeline } from '@/components/OrderTimeline';
import { ReceiptEvidenceView } from '@/components/ReceiptEvidenceView';
import { SettlementRecord } from '@/components/SettlementRecord';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, paymentStatusLabel, paymentStatusTone } from '@/lib/orders';
import { withdrawDispute } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

/** Reasons the requester can report (and retract) — mirrors the RPC gate. */
const WITHDRAWABLE_REASONS: ReadonlySet<string> = new Set([
  'not_received',
  'incorrect',
  'damaged',
  'refused',
]);

/**
 * Historical order for the requester. Informative only, with one deliberate
 * exception: retracting the requester's OWN unresolved delivery report, which
 * resumes the exact pre-dispute state (`delivered`) rather than mutating a
 * terminal outcome. Everything else here is strictly read-only.
 */
export function RequesterHistoryDetail({
  order,
  onChanged,
  refreshToken = 0,
}: {
  order: OrderWithDetails;
  onChanged: () => void;
  /** Bump to refetch embedded live sections (e.g. other-party rating). */
  refreshToken?: number;
}) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const canWithdraw =
    order.status === 'disputed' &&
    !order.resolvedAt &&
    !!order.disputeReason &&
    WITHDRAWABLE_REASONS.has(order.disputeReason);

  const handleWithdraw = async () => {
    if (withdrawing) return;
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await withdrawDispute(order.id);
      onChanged();
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : 'Could not withdraw the report.');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card>
        <Text variant="caption" color="muted">
          Read-only record
        </Text>
        {order.status === 'completed' ? (
          <>
            <Badge label="Completed" tone="success" />
            {order.resolvedAt ? (
              <>
                <Text variant="subtitle">Settled after dispute</Text>
              </>
            ) : (
              <>
                <Text variant="subtitle">Delivered and paid</Text>
                <Text color="secondary">
                  Placed {formatOrderDate(order.createdAt)}
                  {order.deliveredAt ? ` · delivered ${formatOrderDate(order.deliveredAt)}` : ''}.
                </Text>
              </>
            )}
            <SettlementRecord order={order} />
          </>
        ) : order.status === 'cancelled' ? (
          <>
            <Badge label="Cancelled" tone="error" />
            <Text variant="subtitle">This order was cancelled</Text>
            <Text color="secondary">
              {order.cancelReason === 'food_unavailable'
                ? 'The stall had no food. You owe nothing.'
                : `Cancelled${order.cancelReason ? `: ${order.cancelReason}` : ''}.`}
              {order.cancelledAt ? ` (${formatOrderDate(order.cancelledAt)})` : ''}
            </Text>
            <SettlementRecord order={order} />
          </>
        ) : (
          <>
            <Badge
              label={order.resolvedAt ? `Settled · ${order.resolution ?? 'resolved'}` : 'Under review'}
              tone="error"
            />
            <Text variant="subtitle">Issue under review</Text>
            <Text color="secondary">
              {order.disputeReason === 'late_cancellation'
                ? `You cancelled after the helper paid ${order.foodCostCents ? formatMYR(order.foodCostCents) : 'for the food'}. Settle with your helper directly.`
                : order.disputeReason === 'delivery_failed'
                  ? 'The delivery could not be completed. Settle any food cost directly.'
                  : order.disputeReason === 'helper_unable'
                    ? `Your helper could not continue after paying ${order.foodCostCents ? formatMYR(order.foodCostCents) : 'for the food'}. Settle with them directly.`
                    : order.disputeReason === 'not_received'
                      ? 'Not received.'
                      : order.disputeReason === 'incorrect'
                        ? 'Incorrect items.'
                        : order.disputeReason === 'damaged'
                          ? 'Damaged.'
                          : order.disputeReason === 'refused'
                            ? 'Refused at handover.'
                            : 'Under review.'}
              {order.disputedAt ? ` (flagged ${formatOrderDate(order.disputedAt)})` : ''}
              {order.resolvedAt
                ? ` Settled${order.resolution ? ` as ${order.resolution}` : ''} on ${formatOrderDate(order.resolvedAt)}.`
                : ''}
            </Text>
            {order.disputeDetails ? (
              <Text color="secondary">
                Your report: {order.disputeDetails}
              </Text>
            ) : null}
            {order.disputeNote ? (
              <Text variant="caption" color="muted">
                Resolution note: {order.disputeNote}
              </Text>
            ) : null}
            {canWithdraw ? (
              <>
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
              </>
            ) : null}
          </>
        )}
      </Card>

      {order.status === 'completed' ? (
        <OrderRatingSection order={order} refreshToken={refreshToken} />
      ) : null}

      <Card>
        <View style={styles.heading}>
          <Text variant="title">{order.vendor.name}</Text>
        </View>
        <Text variant="caption" color="secondary">
          Placed {formatOrderDate(order.createdAt)}
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

      <Card>
        <OrderBreakdown
          items={order.items}
          subtotalCents={order.subtotalCents}
          deliveryFeeCents={order.deliveryFeeCents}
        />
        {order.status === 'cancelled' && order.cancelReason === 'food_unavailable' ? (
          <Text variant="caption" color="muted">
            No payment was due.
          </Text>
        ) : null}
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
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
