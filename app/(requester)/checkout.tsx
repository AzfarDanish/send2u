import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { HeaderBack } from '@/components/HeaderBack';
import { DeliverToSheet, locationTypeIcon } from '@/components/location/DeliverToSheet';
import { paymentBrandIcon } from '@/components/payment/brandIcons';
import { PlaceholderImage } from '@/components/PlaceholderImage';
import { RedScreen } from '@/components/RedScreen';
import { Button } from '@/components/ui/Button';
import { DockedActionBar } from '@/components/ui/DockedActionBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useSavedDeliveryLocations } from '@/hooks/useSavedDeliveryLocations';
import { formatMYR } from '@/lib/money';
import { goBackOr } from '@/lib/navigation';
import { ESTIMATED_DELIVERY_FEE_CENTS, paymentBrandById } from '@/lib/orders';
import { placeOrders } from '@/services/orders';
import type { CartLine } from '@/types/domain';

/**
 * Per-vendor checkout for a single vendor's cart.
 *
 * Shows only this vendor's lines and their subtotal, then the same
 * saved-location card, instruction, leave-at-door and payment-brand chooser as
 * the old combined Review Request. Order placement calls `placeOrders` with
 * ONLY this vendor's lines — the backend logic is untouched, and every other
 * vendor's still-pending cart is left in the draft. On success the submitted
 * vendor's lines clear via `clearVendor`; other vendors stay for their own
 * checkout. Payment method stays the single global draft choice, unchanged.
 */

interface VendorCartView {
  vendorId: string;
  vendorName: string;
  lines: CartLine[];
  subtotalCents: number;
}

export default function CheckoutScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const {
    lines,
    setQuantity,
    removeItem,
    clearVendor,
    paymentBrandId,
    paymentMethod,
  } = useCart();
  const saved = useSavedDeliveryLocations();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [leaveAtDoor, setLeaveAtDoor] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // One vendor's cart only — every other cart is deliberately excluded here.
  const cart = useMemo<VendorCartView | null>(() => {
    if (typeof vendorId !== 'string') return null;
    const vendorLines = lines.filter((line) => line.item.vendorId === vendorId);
    if (vendorLines.length === 0) return null;
    const subtotalCents = vendorLines.reduce(
      (sum, line) => sum + line.item.priceCents * line.quantity,
      0,
    );
    return {
      vendorId,
      vendorName: vendorLines[0].item.vendor.name,
      lines: vendorLines,
      subtotalCents,
    };
  }, [lines, vendorId]);

  const feeEstimateCents = cart ? ESTIMATED_DELIVERY_FEE_CENTS : 0;
  const totalEstimateCents = cart ? cart.subtotalCents + feeEstimateCents : 0;
  const activeSaved = saved.locations.find((location) => location.isSelected) ?? null;
  const brand = paymentBrandById(paymentBrandId);
  const canSubmit =
    cart !== null &&
    activeSaved !== null &&
    paymentMethod !== null &&
    !submitting &&
    saved.status === 'ready';

  async function handlePlaceRequest(): Promise<void> {
    if (!canSubmit || !cart || !activeSaved || !paymentMethod) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const summaries = await placeOrders({
        savedLocationId: activeSaved.id,
        lines: cart.lines.map((line) => ({
          menuItemId: line.item.id,
          quantity: line.quantity,
        })),
        paymentMethod,
        instruction: instruction.trim() === '' ? null : instruction.trim(),
        leaveAtDoor,
      });
      // Clear only this vendor's cart; any other vendor's draft stays put.
      clearVendor(cart.vendorId);
      // Step back to Carts (or Home), then forward so a cleared checkout never
      // sits in history inviting a resubmit.
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
      // This vendor's cart, location and payment stay intact to retry.
      setSubmitError(err instanceof Error ? err.message : 'Could not place your request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!cart) {
    return (
      <RedScreen
        title="Checkout"
        titleSize="title"
        leading={<HeaderBack fallbackHref="/(requester)" color={colors.onPrimary} />}>
        <EmptyState
          icon="shopping-cart"
          title="Nothing to check out"
          message="This vendor's cart is empty."
          actionTitle="Back to carts"
          onAction={() => goBackOr('/(requester)/carts')}
        />
      </RedScreen>
    );
  }

  return (
    <RedScreen
      title={`${cart.vendorName} · Checkout`}
      titleSize="title"
      leading={<HeaderBack fallbackHref="/(requester)/carts" color={colors.onPrimary} />}
      scrollable={false}
      contentStyle={styles.shell}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Text variant="subtitle">Items ({cart.lines.reduce((s, l) => s + l.quantity, 0)})</Text>
        <View>
          {cart.lines.map((line, index) => (
            <View
              key={line.item.id}
              style={index < cart.lines.length - 1 ? styles.divider : undefined}>
              <View style={styles.itemRow}>
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
                <View style={styles.stepperWrap}>
                  <Button
                    title="−"
                    variant="tertiary"
                    disabled={line.quantity <= 1}
                    onPress={() => setQuantity(line.item.id, line.quantity - 1)}
                  />
                  <Text variant="subtitle" style={styles.qty}>
                    {line.quantity}
                  </Text>
                  <Button
                    title="+"
                    variant="tertiary"
                    disabled={line.quantity >= 99}
                    onPress={() => setQuantity(line.item.id, line.quantity + 1)}
                  />
                </View>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${line.item.name}`}
                  haptic="selection"
                  onPress={() => removeItem(line.item.id)}
                  style={styles.removeButton}>
                  <MaterialIcons name="close" size={20} color={colors.muted} />
                </PressableScale>
              </View>
            </View>
          ))}
        </View>

        <Text variant="subtitle" style={styles.sectionLabel}>
          Delivery Location
        </Text>
        {saved.status === 'loading' ? (
          <SkeletonList rows={1} lines={2} thumb={44} label="Loading saved locations" />
        ) : null}
        {saved.status === 'error' ? (
          <ErrorState
            title="Couldn't load locations"
            message={saved.error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={saved.retry}
          />
        ) : null}
        {saved.status === 'empty' ? (
          <EmptyState
            icon="place"
            title="No saved locations"
            message="Save your first delivery spot to check out."
            actionTitle="Set a location"
            onAction={() => router.push('/(requester)/set-location')}
          />
        ) : null}
        {saved.status === 'ready' ? (
          <View style={styles.locationBlock}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                activeSaved
                  ? `Deliver to ${activeSaved.label}. Change saved location.`
                  : 'Choose a saved location'
              }
              onPress={() => setSheetOpen(true)}
              haptic="selection"
              style={styles.savedRow}>
              <View style={styles.iconChip}>
                <MaterialIcons
                  name={activeSaved ? locationTypeIcon(activeSaved.locationType) : 'place'}
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.itemText}>
                <Text variant="secondary" style={styles.itemName} numberOfLines={1}>
                  {activeSaved ? activeSaved.label : 'Choose a saved location'}
                </Text>
                {activeSaved?.subDetails ? (
                  <Text variant="caption" color="secondary" numberOfLines={2}>
                    {activeSaved.subDetails}
                  </Text>
                ) : null}
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
            </PressableScale>
            <Input
              label="Delivery instruction (optional)"
              placeholder="How does the helper recognise the spot?"
              value={instruction}
              onChangeText={setInstruction}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={500}
            />
            <View style={styles.leaveRow}>
              <View style={styles.itemText}>
                <Text variant="secondary" style={styles.itemName}>
                  Leave at the door
                </Text>
                <Text variant="caption" color="secondary">
                  The helper drops off without a handover.
                </Text>
              </View>
              <Switch
                accessibilityRole="switch"
                accessibilityLabel="Leave at the door"
                accessibilityState={{ checked: leaveAtDoor }}
                value={leaveAtDoor}
                onValueChange={setLeaveAtDoor}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
          </View>
        ) : null}

        <Text variant="subtitle" style={styles.sectionLabel}>
          Payment Method
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            brand ? `Pay with ${brand.label}. Change payment method.` : 'Choose a payment method'
          }
          onPress={() => router.push('/(requester)/payment-method')}
          haptic="selection"
          style={styles.savedRow}>
          <View style={styles.iconChip}>
            <MaterialIcons
              name={brand ? paymentBrandIcon(brand.id) : 'payment'}
              size={22}
              color={colors.primary}
            />
          </View>
          <View style={styles.itemText}>
            <Text variant="secondary" style={styles.itemName} numberOfLines={1}>
              {brand ? brand.label : 'Choose a payment method'}
            </Text>
            {brand ? (
              <Text variant="caption" color="secondary" numberOfLines={1}>
                {brand.hint}
              </Text>
            ) : null}
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
        </PressableScale>

          <Text variant="subtitle" style={styles.sectionLabel}>
            Order Summary
          </Text>
          <View style={styles.totals}>
            {cart.lines.map((line) => (
              <View key={line.item.id} style={styles.totalRow}>
                <Text color="secondary" numberOfLines={1} style={styles.summaryItem}>
                  {line.quantity} × {line.item.name}
                </Text>
                <Text variant="secondary" style={styles.numeric}>
                  {formatMYR(line.item.priceCents * line.quantity)}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text color="secondary">Items Subtotal</Text>
              <Text variant="secondary" style={styles.numeric}>
                {formatMYR(cart.subtotalCents)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text color="secondary">Delivery Fee (est.)</Text>
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
              Fee confirmed at submit.
            </Text>
          </View>

          {submitError ? (
            <ErrorState
              title="Request failed"
              message={submitError}
              retryTitle="Try again"
              onRetry={() => void handlePlaceRequest()}
            />
          ) : null}
        </ScrollView>

        <DockedActionBar>
          <Button
            title={
              submitting
                ? 'Placing…'
                : paymentMethod === 'online'
                  ? 'Continue to Payment'
                  : paymentMethod === 'cod'
                    ? 'Place COD Order'
                    : 'Place Order'
            }
            onPress={() => void handlePlaceRequest()}
            disabled={!canSubmit}
            loading={submitting}
          />
        </DockedActionBar>
        <DeliverToSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          locations={saved.locations}
          activeLocationId={saved.activeLocationId}
          onSelect={(id) => void saved.selectLocation(id)}
          status={saved.status}
          error={saved.error}
          onRetry={saved.retry}
          onOpenRefresh={saved.refresh}
        />
    </RedScreen>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 0, paddingBottom: 0, gap: 0 },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  sectionLabel: { marginTop: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
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
  stepperWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qty: { minWidth: 28, textAlign: 'center' },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationBlock: { gap: spacing.md },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  totals: { gap: spacing.sm },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryItem: { flex: 1 },
  numeric: { fontVariant: ['tabular-nums'] as const },
});
