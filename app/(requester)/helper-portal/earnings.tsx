import { StyleSheet, View } from 'react-native';

import { HeaderBack } from '@/components/HeaderBack';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { RedScreen } from '@/components/RedScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { useMyDeliveryHistory } from '@/hooks/useMyDeliveryHistory';
import { settledEarningsCents } from '@/lib/helperStats';
import { formatMYR } from '@/lib/money';
import { formatOrderDate } from '@/lib/orders';

/**
 * Helper earnings: the delivery fees that have actually settled.
 *
 * Read-only and derived from the same records the Deliveries tab shows, so the
 * total here and the "Settled earnings so far" line there can never disagree.
 * Nothing on this screen claims a payout schedule: the backend tracks per-order
 * settlements, not transfers, so an invented "paid out on Fridays" line would be
 * a promise the system cannot keep.
 */
export default function HelperEarningsScreen() {
  const { deliveries, status, error, retry } = useMyDeliveryHistory();

  const settled = deliveries.filter(
    (delivery) => delivery.status === 'completed' && delivery.settlementStatus === 'settled',
  );
  const totalCents = settledEarningsCents(deliveries);

  return (
    <HelperPortalGuard title="Earnings & Payouts">
      <RedScreen
        title="Earnings & Payouts"
        leading={
          <HeaderBack fallbackHref="/(requester)/helper-portal/profile" color={colors.onPrimary} />
        }>
        <View style={styles.totalBand}>
          <Text variant="caption" color="secondary">
            Settled earnings
          </Text>
          <Text style={styles.total}>{formatMYR(totalCents)}</Text>
          <Text variant="caption" color="secondary">
            {settled.length === 1 ? '1 settled delivery' : `${settled.length} settled deliveries`}
          </Text>
        </View>

        <Text variant="caption" color="secondary">
          Only delivery fees count as earnings. The food is covered by Send2U, and any cash you
          collect on a COD order belongs to Send2U.
        </Text>

        {status === 'loading' ? (
          <SkeletonList rows={4} lines={2} label="Loading your earnings" />
        ) : status === 'error' ? (
          <ErrorState
            title="Couldn't load your earnings"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        ) : settled.length === 0 ? (
          <EmptyState
            icon="payments"
            title="Nothing settled yet"
            message="A delivery fee appears here once its order is completed and settled. Pull to refresh."
          />
        ) : (
          <View>
            {settled.map((delivery, index) => (
              <View
                key={delivery.id}
                style={[styles.row, index < settled.length - 1 && styles.divider]}>
                <View style={styles.rowText}>
                  <Text variant="secondary" numberOfLines={1}>
                    {delivery.vendor.name}
                  </Text>
                  <Text variant="caption" color="secondary" numberOfLines={1}>
                    {formatOrderDate(delivery.createdAt)} · {delivery.location.name}
                  </Text>
                </View>
                <Text color="primary" style={styles.amount}>
                  {formatMYR(delivery.deliveryFeeCents)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Explicit: the list is loaded on focus, not pushed, so a helper who
            just finished a delivery can pull for the settled row. */}
        {status === 'ready' && settled.length > 0 ? (
          <Text variant="caption" color="secondary">
            Pull down to refresh after a delivery closes.
          </Text>
        ) : null}
      </RedScreen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  totalBand: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
  total: { ...typography.display, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: spacing.xs },
  amount: { ...typography.price, color: colors.primary },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
});
