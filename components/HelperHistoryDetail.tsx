import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { OrderRatingSection } from '@/components/OrderRatingSection';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { OrderTimeline } from '@/components/OrderTimeline';
import { ReceiptEvidenceView } from '@/components/ReceiptEvidenceView';
import { SettlementRecord } from '@/components/SettlementRecord';
import { Badge } from '@/components/ui/Badge';
import { Section } from '@/components/ui/Section';
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
export function HelperHistoryDetail({
  job,
  refreshToken = 0,
}: {
  job: OrderWithDetails;
  /** Bump to refetch embedded live sections (e.g. other-party rating). */
  refreshToken?: number;
}) {
  return (
    <View style={styles.container}>
      <Card>
        <Text variant="caption" color="muted">
          Read-only record
        </Text>
        {job.status === 'completed' ? (
          <>
            <Badge label="Completed" tone="success" />
            {job.resolvedAt ? (
              <>
                <Text variant="subtitle">Settled after dispute</Text>
              </>
            ) : (
              <>
                <Text variant="subtitle">Delivery complete</Text>
                <Text color="secondary">
                  Your {formatMYR(job.deliveryFeeCents)} earning is finalized
                  {job.deliveredAt ? ` · delivered ${formatOrderDate(job.deliveredAt)}` : ''}.
                </Text>
              </>
            )}
            <SettlementRecord order={job} />
          </>
        ) : (
          <>
            <Badge
              label={job.resolvedAt ? `Settled · ${job.resolution ?? 'resolved'}` : 'Disputed'}
              tone="error"
            />
            <Text variant="subtitle">This delivery needs settlement</Text>
            <Text color="secondary">
              {job.disputeReason === 'helper_unable'
                ? 'You stopped after paying. '
                : job.disputeReason === 'late_cancellation'
                  ? 'Cancelled after you paid. '
                  : job.disputeReason === 'not_received' ||
                      job.disputeReason === 'incorrect' ||
                      job.disputeReason === 'damaged' ||
                      job.disputeReason === 'refused'
                    ? 'Requester reported a problem. '
                    : ''}
              {job.foodCostCents
                ? `Your fronted ${formatMYR(job.foodCostCents)} is recorded. `
                : ''}
              {job.disputedAt ? `(flagged ${formatOrderDate(job.disputedAt)})` : ''}
              {job.resolvedAt
                ? ` Settled${job.resolution ? ` as ${job.resolution}` : ''} on ${formatOrderDate(job.resolvedAt)}.`
                : ''}
            </Text>
            {job.disputeDetails ? (
              <Text color="secondary">
                Requester&apos;s report: {job.disputeDetails}
              </Text>
            ) : null}
            {job.disputeNote ? (
              <Text variant="caption" color="muted">
                Resolution note: {job.disputeNote}
              </Text>
            ) : null}
          </>
        )}
      </Section>

      {job.status === 'completed' ? (
        <OrderRatingSection order={job} refreshToken={refreshToken} />
      ) : null}

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
          Requester {job.requesterId.slice(0, 8)}…
        </Text>
      </Section>

      <Card>
        <OrderBreakdown
          items={job.items}
          subtotalCents={job.subtotalCents}
          deliveryFeeCents={job.deliveryFeeCents}
          frontedCents={job.foodCostCents}
        />
        <Text variant="caption" color="muted">
          Only the delivery fee counts as your payout.
        </Text>
      </Section>

      <Card>
        <Text variant="subtitle">What happened</Text>
        <OrderTimeline order={job} />
      </Section>

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
          </>
        ) : (
          <Text color="secondary">
            {job.status === 'completed'
              ? 'No payment record was stored for this delivery.'
              : 'No receipt was submitted for this delivery.'}
          </Text>
        )}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, gap: spacing.xs },
  placeName: { fontWeight: '600', color: colors.text },
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
