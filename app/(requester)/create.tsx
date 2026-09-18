import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { PlaceholderImage } from '@/components/PlaceholderImage';
import { QuantityStepper } from '@/components/QuantityStepper';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useDeliveryLocations } from '@/hooks/useDeliveryLocations';
import { formatMYR } from '@/lib/money';
import { ESTIMATED_DELIVERY_FEE_CENTS, orderTotalCents } from '@/lib/orders';
import { placeOrders } from '@/services/orders';
import type { CartLine, PaymentMethod } from '@/types/domain';

interface VendorGroup {
  vendorId: string;
  vendorName: string;
  locationHint: string | null;
  lines: CartLine[];
  subtotalCents: number;
}

/**
 * Review Request — cart review, delivery-location selection, payment-method
 * selection, and Submit Request. Orders are created server-side via
 * `send2u_place_orders` (one order per vendor); the cart clears only after
 * confirmed success. Send2U records the transaction from birth: online
 * payments are simulated in-app, COD is cash on delivery — the helper never
 * finances food and there are no helper QR transfers.
 *
 * Notes are intentionally absent: the backend accepts item ids +
 * quantities only, so a notes field would mislead (nothing carries it
 * to the vendor or helper). There is likewise no edit mode — quantities
 * are always directly editable via the steppers.
 */
export default function CreateRequestScreen() {
  const { lines, count, subtotalCents, setQuantity, removeItem, clear, locationId } = useCart();
  const locations = useDeliveryLocations();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');

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
  // Pre-submit estimate only: the authoritative fee is recorded server-side
  // per order at submit time (one fee per vendor order).
  const feeEstimateCents = groups.length * ESTIMATED_DELIVERY_FEE_CENTS;
  const totalEstimateCents = orderTotalCents(subtotalCents, feeEstimateCents);
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
        paymentMethod,
      );
      clear();
      // Terminal transition: the emptied cart must leave history, so step
      // back to the menu first, then open the next screen on top — back
      // from there returns to the menu, never to a cleared Review Request
      // that invites resubmit. (`router.replace` cannot do this:
      // expo-router downgrades every action to JUMP_TO on tab navigators,
      // so a replace would append and strand the empty cart underneath.)
      // Online orders go straight to the simulated payment; COD and
      // multi-vendor orders land on the confirmation screen, which fetches
      // the real just-created orders by ID.
      if (router.canGoBack()) router.back();
      if (summaries.length === 1 && paymentMethod === 'online') {
        router.push({
          pathname: '/(requester)/orders/[id]/pay-online',
          params: { id: summaries[0].orderId },
        });
        return;
      }
      router.push({
        pathname: '/(requester)/orders/confirmation',
        params: { orderIds: summaries.map((s) => s.orderId).join(',') },
      });
    } catch (err) {
      // Cart and location stay intact so the requester can retry.
      setSubmitError(err instanceof Error ? err.message : 'Could not place your request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <GlassHeader title="Review Request" />
      <Screen beneathHeader>
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
            <Text variant="subtitle">Order Items ({count})</Text>
            {groups.map((group) => (
              <View key={group.vendorId} style={styles.group}>
                {group.lines.map((line) => (
                  <View key={line.item.id} style={styles.itemRow}>
                    <View style={styles.thumb}>
                      <PlaceholderImage style={styles.thumbImage} />
                    </View>
                    <View style={styles.itemText}>
                      <Text variant="secondary" style={styles.itemName} numberOfLines={2}>
                        {line.item.name}
                      </Text>
                      <Text variant="secondary" color="secondary" style={styles.numeric}>
                        {formatMYR(line.item.priceCents)}
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
                <Text variant="subtitle" style={styles.sectionLabel}>
                  Vendor
                </Text>
                <View style={styles.vendorRow}>
                  <View style={styles.vendorThumb}>
                    <PlaceholderImage style={styles.thumbImage} />
                  </View>
                  <View style={styles.itemText}>
                    <Text variant="secondary" style={styles.itemName} numberOfLines={1}>
                      {group.vendorName}
                    </Text>
                    {group.locationHint ? (
                      <Text variant="caption" color="secondary" numberOfLines={1}>
                        {group.locationHint}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}

            <Text variant="subtitle" style={styles.sectionLabel}>
              Drop-off Location
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose drop-off location"
              onPress={() => router.push('/(requester)/location')}
              style={({ pressed }) => [styles.locationSummary, pressed && styles.pressed]}>
              <MaterialIcons name="place" size={22} color={colors.primary} />
              <View style={styles.itemText}>
                <Text variant="secondary" style={styles.itemName} numberOfLines={1}>
                  {selectedLocation ? selectedLocation.name : 'Choose a drop-off point'}
                </Text>
                {selectedLocation?.description ? (
                  <Text variant="caption" color="secondary" numberOfLines={1}>
                    {selectedLocation.description}
                  </Text>
                ) : null}
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
            </Pressable>
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

            {multiVendor ? (
              <Card>
                <Text variant="subtitle">Split by vendor ({groups.length} orders)</Text>
                <Text color="secondary">
                  This request will be split into separate orders because the items come from
                  different vendors.
                </Text>
              </Card>
            ) : null}

            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text color="secondary">Items Subtotal</Text>
                <Text variant="secondary" style={styles.numeric}>
                  {formatMYR(subtotalCents)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text color="secondary">
                  Delivery Fee (est.)
                </Text>
                <Text variant="secondary" style={styles.numeric}>
                  {formatMYR(feeEstimateCents)}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text variant="subtitle">Total (est.)</Text>
                <Text variant="title" color="primary" style={styles.numeric}>
                  {formatMYR(totalEstimateCents)}
                </Text>
              </View>
              <Text variant="caption" color="muted">
                Fee confirmed at submit.{' '}
                {paymentMethod === 'online'
                  ? 'You pay in Send2U right after (simulated for this demo).'
                  : 'You pay cash to the helper on delivery.'}
              </Text>
            </View>

            <Text variant="subtitle" style={styles.sectionLabel}>
              Payment Method
            </Text>
            <View style={styles.methodGroup}>
              <PaymentMethodOption
                selected={paymentMethod === 'online'}
                title="Online Payment"
                description="Pay in Send2U now (simulated for this demo). No cash needed on delivery."
                onSelect={() => setPaymentMethod('online')}
              />
              <PaymentMethodOption
                selected={paymentMethod === 'cod'}
                title="Cash on Delivery"
                description={`Pay ${formatMYR(totalEstimateCents)} in cash to the helper when your food arrives.`}
                onSelect={() => setPaymentMethod('cod')}
              />
            </View>

            {submitError ? (
              <ErrorState title="Request failed" message={submitError} retryTitle="Try again" onRetry={() => void handlePlaceRequest()} />
            ) : null}
            <Button
              title={
                submitting
                  ? 'Placing…'
                  : paymentMethod === 'online'
                    ? 'Continue to Payment'
                    : 'Place COD Order'
              }
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
          </>
        )}
      </Screen>
    </>
  );
}

function PaymentMethodOption({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.methodOption,
        selected && styles.methodOptionSelected,
        pressed && styles.pressed,
      ]}>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.itemText}>
        <Text variant="secondary" style={styles.itemName}>
          {title}
        </Text>
        <Text variant="caption" color="secondary">
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  group: { gap: spacing.md },
  sectionLabel: { marginTop: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
  },
  thumbImage: { borderRadius: radii.md },
  itemText: { flex: 1, gap: spacing.xs },
  itemName: { fontWeight: '600', color: colors.text },
  vendorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vendorThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
  },
  locationSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  totals: { gap: spacing.sm },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  numeric: { fontVariant: ['tabular-nums'] as const },
  stateCard: { minHeight: 160, justifyContent: 'center' },
  methodGroup: { gap: spacing.sm },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  methodOptionSelected: { borderColor: colors.primary, borderWidth: 1.5 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
