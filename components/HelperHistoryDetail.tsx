import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OrderRatingSection } from '@/components/OrderRatingSection';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { OrderTimeline } from '@/components/OrderTimeline';
import { ReceiptEvidenceView } from '@/components/ReceiptEvidenceView';
import { SettlementRecord } from '@/components/SettlementRecord';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { openMapsLocation } from '@/lib/maps';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, paymentStatusLabel } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Read-only historical delivery for the helper. Structured as a record:
 * outcome first, then the route (with external-maps handoff), then
 * delivery information, timeline, and the payment record. Renders no
 * accept/advance/verify actions — those live on the active job screen
 * only. No approval or review workflow exists anywhere in this flow.
 */
export function HelperHistoryDetail({
  job,
  refreshToken = 0,
}: {
  job: OrderWithDetails;
  /** Bump to refetch embedded live sections (e.g. other-party rating). */
  refreshToken?: number;
}) {
  const [mapsBusy, setMapsBusy] = useState(false);

  const openMaps = useCallback(async (label: string) => {
    if (mapsBusy) return;
    setMapsBusy(true);
    try {
      await openMapsLocation(label);
    } finally {
      setMapsBusy(false);
    }
  }, [mapsBusy]);

  const pickupLabel = job.vendor.locationHint ?? job.vendor.name;

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        {job.status === 'completed' ? (
          <>
            {job.resolvedAt ? (
              <Text variant="title">Settled after dispute</Text>
            ) : (
              <>
                <Text variant="title">Delivery complete</Text>
                <Text color="secondary">
                  Your {formatMYR(job.deliveryFeeCents)} earning is finalized
                  {job.deliveredAt ? ` · delivered ${formatOrderDate(job.deliveredAt)}` : ''}.
                </Text>
              </>
            )}
            <SettlementRecord order={job} />
          </>
        ) : job.status === 'cancelled' ? (
          <>
            <Text variant="title">This job was cancelled</Text>
            <Text color="secondary">
              {job.cancelReason === 'food_unavailable'
                ? 'No food — no money changed hands.'
                : `Cancelled${job.cancelReason ? `: ${job.cancelReason}` : ''}.`}
              {job.cancelledAt ? ` (${formatOrderDate(job.cancelledAt)})` : ''}
            </Text>
            <SettlementRecord order={job} />
          </>
        ) : (
          <>
            <Text variant="title">This delivery needs settlement</Text>
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
                Report: {job.disputeDetails}
              </Text>
            ) : null}
            {job.disputeNote ? (
              <Text variant="caption" color="muted">
                Resolution note: {job.disputeNote}
              </Text>
            ) : null}
          </>
        )}
      </Card>

      {job.status === 'completed' ? (
        <OrderRatingSection order={job} refreshToken={refreshToken} cardStyle={styles.card} />
      ) : null}

      <Card style={styles.card}>
        <Text variant="subtitle">{job.vendor.name}</Text>
        <Text variant="caption" color="secondary">
          Requested {formatOrderDate(job.createdAt)}
          {job.acceptedAt ? ` · you accepted ${formatOrderDate(job.acceptedAt)}` : ''}
        </Text>
        <View style={styles.placeRow}>
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
          <Button
            title="Open Maps"
            variant="secondary"
            onPress={() => void openMaps(pickupLabel)}
            disabled={mapsBusy}
          />
        </View>
        <View style={styles.placeRow}>
          <MaterialIcons name="place" size={20} color={colors.primary} />
          <View style={styles.rowText}>
            <Text variant="secondary" style={styles.placeName}>
              Dropped off at {job.location.name}
            </Text>
          </View>
          <Button
            title="Open Maps"
            variant="secondary"
            onPress={() => void openMaps(job.location.name)}
            disabled={mapsBusy}
          />
        </View>
        <Text variant="caption" color="muted">
          Requester {job.requesterId.slice(0, 8)}…
        </Text>
      </Card>

      <Card style={styles.card}>
        <OrderBreakdown
          items={job.items}
          subtotalCents={job.subtotalCents}
          deliveryFeeCents={job.deliveryFeeCents}
          frontedCents={job.foodCostCents}
        />
        <Text variant="caption" color="muted">
          Only the delivery fee counts as your payout.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">What happened</Text>
        <OrderTimeline order={job} />
      </Card>

      <Card style={styles.card}>
        <Text variant="subtitle">Payment record</Text>
        <Text variant="caption" color="secondary">
          {job.payment ? paymentStatusLabel(job.payment.status) : 'No payment'}
        </Text>
        {job.payment ? (
          <>
            <Text color="secondary">
              {formatMYR(job.payment.amountCents)} receipt · submitted{' '}
              {formatOrderDate(job.payment.submittedAt)}
              {job.payment.verifiedAt
                ? ` · recorded ${formatOrderDate(job.payment.verifiedAt)}`
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
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  // Bordered, explicitly shadow-free card surface.
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, gap: spacing.xs },
  placeName: { fontWeight: '600', color: colors.text },
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
