import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { QuantityStepper } from '@/components/QuantityStepper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { formatMYR } from '@/lib/money';

/**
 * New Request tab — the visible home of the local cart for this MVP stage.
 * Cart is in-memory only: no checkout, no order creation, no fees.
 */
export default function CreateRequestScreen() {
  const { lines, count, subtotalCents, setQuantity, removeItem, clear } = useCart();

  return (
    <Screen>
      <SectionHeader
        eyebrow="New request"
        title="Your cart"
        badge={count > 0 ? `${count} item${count === 1 ? '' : 's'}` : undefined}
      />
      {lines.length === 0 ? (
        <EmptyState
          icon="add-shopping-cart"
          title="Your cart is empty"
          message="Browse today's menu and add something tasty. Checkout arrives in the next step."
          actionTitle="Browse menu"
          onAction={() => router.push('/(requester)')}
        />
      ) : (
        <>
          <Card style={styles.linesCard}>
            {lines.map((line) => (
              <View key={line.item.id} style={styles.line}>
                <View style={styles.lineText}>
                  <Text variant="secondary" style={styles.lineName}>
                    {line.quantity} × {line.item.name}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {line.item.vendor.name} · {formatMYR(line.item.priceCents)} each
                  </Text>
                </View>
                <QuantityStepper
                  value={line.quantity}
                  min={0}
                  onChange={(next) =>
                    next === 0 ? removeItem(line.item.id) : setQuantity(line.item.id, next)
                  }
                />
              </View>
            ))}
          </Card>
          <Card>
            <View style={styles.subtotalRow}>
              <Text variant="subtitle">Subtotal</Text>
              <Text variant="title" color="primary">
                {formatMYR(subtotalCents)}
              </Text>
            </View>
            <Text variant="caption" color="muted">
              Simple sum of price × quantity. No delivery, service, or platform fees in this MVP stage.
            </Text>
          </Card>
          <Card>
            <Badge label="Checkout coming soon" tone="info" />
            <Text variant="subtitle">Ordering opens next</Text>
            <Text color="secondary">
              Checkout, payment instructions, and order creation arrive in the next task. Your cart stays on
              this device until then.
            </Text>
            <Button title="Clear cart" variant="danger" onPress={clear} />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  linesCard: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  lineText: { flex: 1, gap: 2 },
  lineName: { fontWeight: '600', color: colors.text },
  subtotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
