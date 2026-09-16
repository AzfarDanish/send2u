import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { formatOrderDate } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

const REASON_LABELS: Record<string, string> = {
  late_cancellation: 'Late cancellation',
  delivery_failed: 'Failed delivery',
  helper_unable: 'Helper unable to continue',
  not_received: 'Not received',
  incorrect: 'Incorrect items',
  damaged: 'Damaged',
  refused: 'Refused at handover',
};

/**
 * Settlement record for admin-resolved disputes. Renders only when the order
 * carries a resolution — i.e. `resolvedAt` is set, which happens exclusively
 * through `send2u_resolve_dispute` settled as completed (a cancelled
 * settlement permanently deletes the order, so nothing to record remains).
 * "Delivered and paid" would otherwise mislead the requester, since no money
 * moved in-app: settlement is manual and external.
 */
export function SettlementRecord({ order }: { order: OrderWithDetails }) {
  if (!order.resolvedAt) return null;
  const detailsText = !order.disputeDetails
    ? ''
    : /[.!?]$/.test(order.disputeDetails)
      ? ` ${order.disputeDetails}`
      : ` ${order.disputeDetails}.`;
  return (
    <View style={styles.container}>
      <Text color="secondary">
        Dispute{order.disputeReason ? ` (${REASON_LABELS[order.disputeReason] ?? order.disputeReason})` : ''}:
        {detailsText}
        {order.disputedAt ? ` Flagged ${formatOrderDate(order.disputedAt)}.` : ''}
        {` Settled${order.resolution ? ` as ${order.resolution}` : ''} on ${formatOrderDate(order.resolvedAt)} — manual settlement outside Send2U.`}
      </Text>
      {order.disputeNote ? (
        <Text variant="caption" color="muted">
          Resolution note: {order.disputeNote}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
});
