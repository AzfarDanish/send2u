import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useTransaction } from '@/hooks/useTransaction';
import { formatMYR } from '@/lib/money';
import { paymentMethodLabel, paymentStatusLabel, settlementStatusLabel } from '@/lib/orders';

/**
 * Transaction Record: the platform's account of one order — method, payment
 * state, and the simulated settlement split (vendor / helper earning /
 * Send2U). Read-only; every value comes from Supabase. For judges and
 * record-keeping, not an enterprise dashboard.
 */
export function TransactionRecord({ orderId }: { orderId: string }) {
  const { context, status } = useTransaction(orderId);

  if (status === 'loading' || !context) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator size="small" color={colors.primary} />
      </Card>
    );
  }
  if (status === 'error') return null;

  const settlement = context.settlement;

  return (
    <Card style={styles.card}>
      <Text variant="subtitle">Transaction Record</Text>
      <View style={styles.rows}>
        <Row label="Method" value={paymentMethodLabel(context.paymentMethod)} />
        <Row label="Payment" value={paymentStatusLabel(context.paymentStatus, context.paymentMethod)} />
        <Row label="Amount" value={formatMYR(context.totalCents)} numeric />
        {context.paymentMethod === 'cod' && context.codCollectedCents != null ? (
          <Row label="Cash collected" value={formatMYR(context.codCollectedCents)} numeric />
        ) : null}
        {settlement ? (
          <>
            <Row label="Cafeteria" value={formatMYR(settlement.vendorAmountCents)} numeric />
            <Row label="Helper earning" value={formatMYR(settlement.helperAmountCents)} numeric />
            <Row
              label="Send2U"
              value={formatMYR(settlement.platformAmountCents)}
              numeric
            />
            <Row label="Settlement" value={settlementStatusLabel(context.settlementStatus)} />
          </>
        ) : (
          <Row label="Settlement" value={settlementStatusLabel(context.settlementStatus)} />
        )}
        {context.refundedAt ? (
          <Text variant="caption" color="muted">
            Refunded (simulated) — no real money moved.
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function Row({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  return (
    <View style={styles.row}>
      <Text color="secondary">{label}</Text>
      <Text variant="secondary" style={numeric && styles.numeric}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  rows: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numeric: { fontVariant: ['tabular-nums'] as const },
});
