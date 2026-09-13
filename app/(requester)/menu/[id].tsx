import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { QuantityStepper } from '@/components/QuantityStepper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { formatMYR } from '@/lib/money';
import { getMenuItem } from '@/services/menu';
import type { MenuItemWithVendor } from '@/types/domain';

/**
 * Menu item detail. Quantity + Add to Cart write to the local in-memory cart
 * only — no order is created here. Review and submit in Review Request
 * (`app/(requester)/create.tsx`).
 */
export default function MenuItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addItem } = useCart();
  const [item, setItem] = useState<MenuItemWithVendor | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  // Reset per-item state during render when the route id changes (the
  // React-endorsed alternative to setState-in-effect); the effect below
  // then only performs the async fetch. Inert on mount: the initial
  // values already match the reset values.
  const [seenId, setSeenId] = useState(id);
  if (seenId !== id) {
    setSeenId(id);
    setStatus('loading');
    setItem(null);
    setJustAdded(false);
    setQuantity(1);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const found = typeof id === 'string' ? await getMenuItem(id) : null;
        if (mounted) {
          setItem(found);
          setStatus(found ? 'ready' : 'missing');
        }
      } catch {
        if (mounted) setStatus('missing');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleAdd = useCallback(() => {
    if (!item || !item.isAvailable) return;
    addItem(item, quantity);
    setJustAdded(true);
  }, [item, quantity, addItem]);

  if (status === 'loading' || !item) {
    return (
      <>
        <Stack.Screen options={{ title: 'Item details' }} />
        <Screen>
          {status === 'loading' ? (
            <LoadingState message="Loading item…" />
          ) : (
            <ErrorState
              title="Item unavailable"
              message="This dish isn't on the menu right now. Pick something else tasty."
              retryTitle="Back to menu"
              onRetry={() => router.back()}
            />
          )}
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: item.name }} />
      <Screen>
        <View style={styles.visual}>
          <MaterialIcons name="restaurant-menu" size={48} color={colors.primary} />
        </View>

        <View style={styles.heading}>
          <Text variant="title">{item.name}</Text>
          <Text variant="title" color="primary">
            {formatMYR(item.priceCents)}
          </Text>
        </View>
        {item.description ? <Text color="secondary">{item.description}</Text> : null}

        <Card>
          <View style={styles.vendorRow}>
            <MaterialIcons name="storefront" size={20} color={colors.primary} />
            <View style={styles.vendorText}>
              <Text variant="secondary" style={styles.vendorName}>
                {item.vendor.name}
              </Text>
              {item.vendor.locationHint ? (
                <Text variant="caption" color="secondary">
                  {item.vendor.locationHint}
                </Text>
              ) : null}
              {item.vendor.operatingHours ? (
                <Text variant="caption" color="secondary">
                  {item.vendor.operatingHours}
                </Text>
              ) : null}
              {item.vendor.description ? (
                <Text variant="caption" color="muted">
                  {item.vendor.description}
                </Text>
              ) : null}
            </View>
            {item.isAvailable ? (
              <Badge label="Available" tone="success" />
            ) : (
              <Badge label="Unavailable" tone="warning" />
            )}
          </View>
          {!item.vendor.isOpen ? (
            <Text variant="caption" color="muted">
              This vendor is currently closed.
            </Text>
          ) : null}
        </Card>

        {justAdded ? (
          <Card>
            <View style={styles.confirmRow}>
              <MaterialIcons name="check-circle" size={24} color={colors.success} />
              <Text variant="subtitle">
                {quantity} × {item.name} added
              </Text>
            </View>
            <Button title="View cart" onPress={() => router.push('/(requester)/create')} />
            <Button title="Add more" variant="secondary" onPress={() => setJustAdded(false)} />
          </Card>
        ) : (
          <Card>
            <View style={styles.orderRow}>
              <QuantityStepper value={quantity} onChange={setQuantity} />
              <View style={styles.total}>
                <Text variant="caption" color="secondary">
                  Total
                </Text>
                <Text variant="subtitle">{formatMYR(item.priceCents * quantity)}</Text>
              </View>
            </View>
            <Button
              title={item.isAvailable ? 'Add to cart' : 'Unavailable right now'}
              onPress={handleAdd}
              disabled={!item.isAvailable}
            />
            <Text variant="caption" color="muted">
              Adds to your cart. Review and submit in Review Request.
            </Text>
          </Card>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  visual: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.xl,
    paddingVertical: spacing.xxxl,
  },
  heading: { gap: spacing.sm },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vendorText: { flex: 1, gap: spacing.xs },
  vendorName: { fontWeight: '600', color: colors.text },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  total: { alignItems: 'flex-end', gap: spacing.xs },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
