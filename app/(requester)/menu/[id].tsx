import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { QuantityStepper } from '@/components/QuantityStepper';
import { CartFab } from '@/components/CartFab';
import { PlaceholderImage } from '@/components/PlaceholderImage';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { GlassHeader } from '@/components/GlassHeader';
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
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
    setLoadFailed(false);
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
          setLoadFailed(false);
          setStatus(found ? 'ready' : 'missing');
        }
      } catch {
        if (mounted) {
          setItem(null);
          setLoadFailed(true);
          setStatus('missing');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, retryToken]);

  const handleAdd = useCallback(() => {
    if (!item || !item.isAvailable) return;
    addItem(item, quantity);
    setJustAdded(true);
  }, [item, quantity, addItem]);

  if (status === 'loading' || !item) {
    return (
      <>
        <GlassHeader title="Item details" />
        <Screen beneathHeader>
          {status === 'loading' ? (
            <LoadingState message="Loading item…" />
          ) : loadFailed ? (
            <ErrorState
              title="Couldn't load this item"
              message="Check your connection and try again."
              retryTitle="Try again"
              onRetry={() => {
                setLoadFailed(false);
                setStatus('loading');
                setRetryToken((t) => t + 1);
              }}
            />
          ) : (
            <ErrorState
              title="Item unavailable"
              message="This dish isn't on the menu right now. Pick something else tasty."
              retryTitle="Back to menu"
              onRetry={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(requester)');
              }}
            />
          )}
        </Screen>
      </>
    );
  }

  return (
    <>
      <GlassHeader title={item.name} />
      <Screen beneathHeader>
        <View style={styles.visual}>
          <PlaceholderImage style={styles.visualImage} />
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
        </Section>

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
          </Section>
        ) : (
          <Card>
            <View style={styles.orderRow}>
              <QuantityStepper value={quantity} onChange={setQuantity} />
              <View style={styles.total}>
                <Text variant="caption" color="secondary">
                  Total
                </Text>
                <Text variant="price" style={styles.totalAmount}>
                  {formatMYR(item.priceCents * quantity)}
                </Text>
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
          </Section>
        )}
      </Screen>
      <CartFab />
    </>
  );
}

const styles = StyleSheet.create({
  visual: {
    height: 200,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
  },
  visualImage: { borderRadius: radii.xl },
  heading: { gap: spacing.sm },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vendorText: { flex: 1, gap: spacing.xs },
  vendorName: { fontWeight: '600', color: colors.text },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  total: { alignItems: 'flex-end', gap: spacing.xs },
  totalAmount: { fontVariant: ['tabular-nums'] as const },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
