import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { VendorMark } from '@/components/VendorMark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { formatMYR } from '@/lib/money';
import type { CartLine } from '@/types/domain';

interface VendorCart {
  vendorId: string;
  vendorName: string;
  lines: CartLine[];
  subtotalCents: number;
}

/**
 * Carts — the requester's pre-checkout area, nothing else.
 *
 * Only unsubmitted cart lines live here, grouped by vendor into independent
 * carts. It deliberately shows nothing about orders: an order, however early
 * in fulfilment, belongs to My Orders and never appears on this page. The cart
 * itself is the same in-memory `CartContext` the menu screens already write to
 * — there is no separate cart store and no order record is touched.
 *
 * Grouping and subtotals are pure projection over the existing lines; prices
 * and quantities are the exact `MenuItemWithVendor` values already in the cart.
 * Each vendor's "Continue" routes to its own checkout, so carts never merge.
 */
export default function CartsScreen() {
  const { lines } = useCart();

  const carts = useMemo<VendorCart[]>(() => {
    const byVendor = new Map<string, VendorCart>();
    for (const line of lines) {
      const vendorId = line.item.vendorId;
      const existing = byVendor.get(vendorId);
      if (existing) {
        existing.lines.push(line);
        existing.subtotalCents += line.item.priceCents * line.quantity;
      } else {
        byVendor.set(vendorId, {
          vendorId,
          vendorName: line.item.vendor.name,
          lines: [line],
          subtotalCents: line.item.priceCents * line.quantity,
        });
      }
    }
    return [...byVendor.values()];
  }, [lines]);

  return (
    <>
      <GlassHeader title="Your Carts" fallbackHref="/(requester)" />
      <Screen beneathHeader>
        {lines.length === 0 ? (
          <EmptyState
            icon="shopping-cart"
            title="No carts yet"
            message="Items you add land here, grouped by vendor, until you check out."
            actionTitle="Browse menu"
            onAction={() => router.replace('/(requester)')}
          />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}>
            {carts.map((cart) => (
              <View key={cart.vendorId} style={styles.cartBlock}>
                {/* Vendor header row */}
                <View style={styles.vendorRow}>
                  <VendorMark name={cart.vendorName} size={44} />
                  <View style={styles.vendorText}>
                    <Text variant="subtitle" numberOfLines={1}>
                      {cart.vendorName}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {cart.lines.reduce((sum, line) => sum + line.quantity, 0)} item
                      {cart.lines.reduce((sum, line) => sum + line.quantity, 0) === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>

                {/* Items belonging only to this vendor */}
                <Card style={styles.itemsCard}>
                  {cart.lines.map((line) => (
                    <View key={line.item.id} style={styles.itemRow}>
                      <View style={styles.itemText}>
                        <Text variant="secondary" style={styles.itemName} numberOfLines={2}>
                          {line.item.name}
                        </Text>
                        <Text variant="caption" color="secondary" style={styles.numeric}>
                          {line.quantity} × {formatMYR(line.item.priceCents)}
                        </Text>
                      </View>
                      <Text variant="secondary" style={styles.numeric}>
                        {formatMYR(line.item.priceCents * line.quantity)}
                      </Text>
                    </View>
                  ))}
                </Card>

                {/* Subtotals and actions, one cart per vendor */}
                <View style={styles.subtotalRow}>
                  <Text color="secondary">Subtotal</Text>
                  <Text variant="subtitle" style={styles.numeric}>
                    {formatMYR(cart.subtotalCents)}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    title="Add more"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: '/(requester)/vendors/[id]',
                        params: { id: cart.vendorId },
                      })
                    }
                  />
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Continue to checkout for ${cart.vendorName}`}
                    haptic="selection"
                    onPress={() =>
                      router.push({
                        pathname: '/(requester)/checkout',
                        params: { vendorId: cart.vendorId },
                      })
                    }
                    style={styles.continueButton}>
                    <Text variant="button" color="onPrimary">
                      Continue
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.onPrimary} />
                  </PressableScale>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingBottom: spacing.xxxl },
  cartBlock: { gap: spacing.md },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vendorText: { flex: 1, gap: spacing.xs },
  itemsCard: { gap: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  itemText: { flex: 1, gap: spacing.xs },
  itemName: { fontWeight: '600', color: colors.text },
  numeric: { fontVariant: ['tabular-nums'] as const },
  subtotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  continueButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
});
