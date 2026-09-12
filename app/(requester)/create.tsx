import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QuantityStepper } from '@/components/QuantityStepper';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useDeliveryLocations } from '@/hooks/useDeliveryLocations';
import { formatMYR } from '@/lib/money';
import { placeOrders } from '@/services/orders';
import type { CartLine } from '@/types/domain';

interface VendorGroup {
  vendorId: string;
  vendorName: string;
  locationHint: string | null;
  lines: CartLine[];
  subtotalCents: number;
}

/**
 * New Request tab — cart review, delivery-location selection, and Place
 * Request. Orders are created server-side via `send2u_place_orders`
 * (one order per vendor); the cart clears only after confirmed success.
 */
export default function CreateRequestScreen() {
  const { lines, count, subtotalCents, setQuantity, removeItem, clear } = useCart();
  const locations = useDeliveryLocations();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const groups = useMemo<VendorGroup[]>(() => {
    const byVendor = new Map<string, VendorGroup>();
    for (const line of lines) {
      const existing = byVendor.get(line.item.vendorId);
      if (existing) {
        existing.lines.push(line);
        existing.subtotalCents += line.item.priceCents * line.quantity;
      } else {
        byVendor.set(line.item.vendorId, {
          vendorId: line.item.vendorId,
          vendorName: line.item.vendor.name,
          locationHint: line.item.vendor.locationHint,
          lines: [line],
          subtotalCents: line.item.priceCents * line.quantity,
        });
      }
    }
    return [...byVendor.values()];
  }, [lines]);

  const multiVendor = groups.length > 1;
  const selectedLocation =
    locations.status === 'ready' ? (locations.locations.find((l) => l.id === locationId) ?? null) : null;
  const canSubmit =
    lines.length > 0 && selectedLocation !== null && !submitting && locations.status === 'ready';

  async function handlePlaceRequest(): Promise<void> {
    if (!canSubmit || !selectedLocation) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const summaries = await placeOrders(
        selectedLocation.id,
        lines.map((line) => ({ menuItemId: line.item.id, quantity: line.quantity })),
      );
      // Payable total: food subtotal + the RM2.00 fee recorded server-side
      // on every placed order (one fee per vendor order).
      const foodCents = summaries.reduce((sum, s) => sum + s.subtotalCents, 0);
      const feeCents = summaries.reduce((sum, s) => sum + s.deliveryFeeCents, 0);
      clear();
      router.push({
        pathname: '/(requester)/orders/confirmation',
        params: {
          orderIds: summaries.map((s) => s.orderId).join(','),
          vendorCount: String(summaries.length),
          vendorNames: summaries.map((s) => s.vendorName).join(', '),
          foodCents: String(foodCents),
          feeCents: String(feeCents),
          locationName: selectedLocation.name,
        },
      });
    } catch (err) {
      // Cart and location stay intact so the requester can retry.
      setSubmitError(err instanceof Error ? err.message : 'Could not place your request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <SectionHeader
        eyebrow="New request"
        title={count > 0 ? `Your cart · ${count} item${count === 1 ? '' : 's'}` : 'Your cart'}
      />
      {lines.length === 0 ? (
        <EmptyState
          icon="add-shopping-cart"
          title="Your cart is empty"
          message="Add something from today's menu."
          actionTitle="Browse menu"
          onAction={() => router.push('/(requester)')}
        />
      ) : (
        <>
          {groups.map((group) => (
            <View key={group.vendorId} style={styles.group}>
              <View style={styles.vendorHeader}>
                <View style={styles.vendorText}>
                  <Text variant="subtitle">{group.vendorName}</Text>
                  {group.locationHint ? (
                    <Text variant="caption" color="secondary">
                      {group.locationHint} · {formatMYR(group.subtotalCents)}
                    </Text>
                  ) : (
                    <Text variant="caption" color="secondary">
                      {formatMYR(group.subtotalCents)}
                    </Text>
                  )}
                </View>
              </View>
              <Card style={styles.linesCard}>
                {group.lines.map((line) => (
                  <View key={line.item.id} style={styles.line}>
                    <View style={styles.lineText}>
                      <Text variant="secondary" style={styles.lineName}>
                        {line.quantity} × {line.item.name}
                      </Text>
                      <Text variant="caption" color="secondary">
                        {formatMYR(line.item.priceCents)} each ·{' '}
                        {formatMYR(line.item.priceCents * line.quantity)}
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
            </View>
          ))}

          <Card>
            <View style={styles.subtotalRow}>
              <Text variant="subtitle">Subtotal</Text>
              <Text variant="title" color="primary">
                {formatMYR(subtotalCents)}
              </Text>
            </View>
            <Text variant="caption" color="muted">
              Price × quantity. No fees.
            </Text>
          </Card>

          <SectionHeader title="Delivery location" />
          {locations.status === 'loading' ? (
            <Card style={styles.stateCard}>
              <LoadingState message="Loading drop-off points…" />
            </Card>
          ) : null}
          {locations.status === 'error' ? (
            <Card style={styles.stateCard}>
              <ErrorState
                title="Couldn't load locations"
                message={locations.error ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={locations.retry}
              />
            </Card>
          ) : null}
          {locations.status === 'empty' ? (
            <EmptyState
              icon="place"
              title="No drop-off points"
              message="None available right now. Try again later."
            />
          ) : null}
          {locations.status === 'ready' ? (
            <Card style={styles.locationsCard}>
              {locations.locations.map((location) => {
                const selected = location.id === locationId;
                return (
                  <ListRow
                    key={location.id}
                    icon="place"
                    title={location.name}
                    subtitle={location.description ?? undefined}
                    showChevron={false}
                    onPress={() => setLocationId(location.id)}
                    right={
                      selected ? (
                        <MaterialIcons name="check-circle" size={24} color={colors.primary} />
                      ) : undefined
                    }
                  />
                );
              })}
            </Card>
          ) : null}

          {multiVendor ? (
            <Card>
              <Text variant="subtitle">Split by vendor ({groups.length} orders)</Text>
              <Text color="secondary">
                Each vendor becomes a separate order to the same drop-off point.
              </Text>
            </Card>
          ) : null}

          <Card>
            {submitError ? (
              <ErrorState title="Request failed" message={submitError} retryTitle="Try again" onRetry={() => void handlePlaceRequest()} />
            ) : null}
            <Button
              title={submitting ? 'Placing request…' : `Place request · ${formatMYR(subtotalCents)}`}
              onPress={() => void handlePlaceRequest()}
              disabled={!canSubmit}
              loading={submitting}
            />
            {!selectedLocation && lines.length > 0 ? (
              <Text variant="caption" color="muted">
                Choose a drop-off point to continue.
              </Text>
            ) : null}
            <Text variant="caption" color="muted">
              Prices confirmed at submit. Your cart is kept if anything fails.
            </Text>
            <Button title="Clear cart" variant="danger" onPress={clear} disabled={submitting} />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vendorText: { flex: 1, gap: spacing.xs },
  linesCard: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  lineText: { flex: 1, gap: spacing.xs },
  lineName: { fontWeight: '600', color: colors.text },
  subtotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stateCard: { minHeight: 160, justifyContent: 'center' },
  locationsCard: { gap: 0 },
});
