import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import { orderTotalCents } from '@/lib/orders';
import type { OrderItem } from '@/types/domain';

interface OrderBreakdownProps {
  /** Item lines; omit for totals-only contexts (e.g. the payment card). */
  items?: OrderItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  /** Helper-history snapshot of the Send2U-covered food cost; omit elsewhere. */
  coveredCents?: number | null;
}

/**
 * The single order breakdown used on every surface: item lines
 * (name × quantity, unit price, line total), food subtotal, delivery fee,
 * and the payable total. Plain text rows and dividers — never pills. All
 * numbers are database snapshots; the total is `orderTotalCents`, the one
 * shared definition of food + fee.
 */
export function OrderBreakdown({ items, subtotalCents, deliveryFeeCents, coveredCents }: OrderBreakdownProps) {
  return (
    <View style={styles.container}>
      {items && items.length > 0 ? (
        <>
          <Text variant="subtitle">What you ordered</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.line}>
              <View style={styles.lineText}>
                <Text variant="secondary" style={styles.lineName}>
                  {item.itemName} × {item.quantity}
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
          <View style={styles.divider} />
        </>
      ) : null}
      <View style={styles.row}>
        <Text color="secondary">Food subtotal</Text>
        <Text variant="secondary">{formatMYR(subtotalCents)}</Text>
      </View>
      {coveredCents !== undefined ? (
        <View style={styles.row}>
          <Text color="secondary">Food (covered by Send2U)</Text>
          <Text variant="secondary">{coveredCents !== null ? formatMYR(coveredCents) : '—'}</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <Text color="secondary">Delivery fee</Text>
        <Text variant="secondary">{formatMYR(deliveryFeeCents)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text variant="subtitle">Total amount</Text>
        <Text variant="title" color="primary">
          {formatMYR(orderTotalCents(subtotalCents, deliveryFeeCents))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lineText: { flex: 1, gap: spacing.xs },
  lineName: { fontWeight: '600', color: colors.text },
  lineTotal: { fontWeight: '700', color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
});
