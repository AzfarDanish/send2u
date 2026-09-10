import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { HelperPaymentCard } from '@/components/HelperPaymentCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, orderStatusLabel, orderStatusTone } from '@/lib/orders';
import { acceptOrder, advanceFulfilment, getJobDetail, type FulfilmentAction } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Helper job detail. Review vendor, items, subtotal, and drop-off, then
 * accept. After acceptance, status-driven fulfilment actions walk the order
 * through the physical flow (vendor → purchase → pickup code → delivery).
 * Every transition is one atomic server operation.
 */
export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<OrderWithDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [paymentTick, setPaymentTick] = useState(0);
  const [acting, setActing] = useState<FulfilmentAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pickupCode, setPickupCode] = useState('');

  const reload = useCallback(async () => {
    if (typeof id !== 'string') {
      setJob(null);
      setStatus('missing');
      return;
    }
    try {
      const found = await getJobDetail(id);
      setJob(found);
      setStatus(found ? 'ready' : 'missing');
    } catch {
      setJob(null);
      setStatus('missing');
    }
  }, [id]);

  useEffect(() => {
    setStatus('loading');
    setJob(null);
    setAcceptError(null);
    setAccepted(false);
    setPaymentTick(0);
    setActionError(null);
    setPickupCode('');
    void reload();
  }, [id, reload]);

  const handleAccept = useCallback(async () => {
    if (!job || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await acceptOrder(job.id);
      setAccepted(true);
      await reload();
      setPaymentTick((t) => t + 1);
    } catch (err) {
      // Job stays on screen so the helper can pick another one.
      setAcceptError(err instanceof Error ? err.message : 'Could not accept the job.');
    } finally {
      setAccepting(false);
    }
  }, [job, accepting, reload]);

  const handleAdvance = useCallback(
    async (action: FulfilmentAction, code?: string) => {
      if (!job || acting) return;
      setActing(action);
      setActionError(null);
      try {
        await advanceFulfilment(job.id, action, code);
        await reload();
        setPaymentTick((t) => t + 1);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Could not update the order.');
      } finally {
        setActing(null);
      }
    },
    [job, acting, reload],
  );

  if (status === 'loading' || !job) {
    return (
      <>
        <Stack.Screen options={{ title: 'Job details' }} />
        <Screen>
          {status === 'loading' ? (
            <LoadingState message="Loading job…" />
          ) : (
            <ErrorState
              title="Job not available"
              message="This request is no longer open. It may have been taken by another helper."
              retryTitle="Back to jobs"
              onRetry={() => router.back()}
            />
          )}
        </Screen>
      </>
    );
  }

  const pending = job.status === 'pending' && !accepted;
  const busy = acting !== null;

  return (
    <>
      <Stack.Screen options={{ title: job.vendor.name }} />
      <Screen>
        <View style={styles.heading}>
          <Text variant="title">{job.vendor.name}</Text>
          <Badge
            label={accepted && job.status === 'pending' ? 'Assigned' : orderStatusLabel(job.status)}
            tone={accepted && job.status === 'pending' ? 'success' : orderStatusTone(job.status)}
          />
        </View>
        <Text variant="caption" color="secondary">
          Requested {formatOrderDate(job.createdAt)}
        </Text>

        <Card>
          <View style={styles.row}>
            <MaterialIcons name="storefront" size={20} color={colors.primary} />
            <View style={styles.rowText}>
              <Text variant="secondary" style={styles.vendorName}>
                Pick up here
              </Text>
              {job.vendor.locationHint ? (
                <Text variant="caption" color="secondary">
                  {job.vendor.locationHint}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.row}>
            <MaterialIcons name="place" size={20} color={colors.primary} />
            <View style={styles.rowText}>
              <Text variant="secondary" style={styles.vendorName}>
                Drop off at {job.location.name}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.itemsCard}>
          {job.items.map((item) => (
            <View key={item.id} style={styles.line}>
              <View style={styles.lineText}>
                <Text variant="secondary" style={styles.lineName}>
                  {item.quantity} × {item.itemName}
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
        </Card>

        <Card>
          <View style={styles.subtotalRow}>
            <Text variant="subtitle">Food subtotal</Text>
            <Text variant="title" color="primary">
              {formatMYR(job.subtotalCents)}
            </Text>
          </View>
          <View style={styles.subtotalRow}>
            <Text color="secondary">Delivery earning</Text>
            <Text variant="subtitle" color="primary">
              {formatMYR(job.deliveryFeeCents)}
            </Text>
          </View>
          <Text variant="caption" color="muted">
            You front the food cost at the stall with your own money; the requester pays you food +
            delivery after handover.
          </Text>
        </Card>

        {accepted ? (
          <Card>
            <View style={styles.confirmRow}>
              <MaterialIcons name="check-circle" size={24} color={colors.success} />
              <Text variant="subtitle">Job accepted — it&apos;s yours</Text>
            </View>
            <Text color="secondary">
              This request left the open queue and is waiting in My Deliveries.
            </Text>
            <Button title="View My Deliveries" onPress={() => router.replace('/(helper)/deliveries')} />
            <Button title="Back to jobs" variant="secondary" onPress={() => router.back()} />
          </Card>
        ) : pending ? (
          <Card>
            {acceptError ? (
              <ErrorState title="Could not accept" message={acceptError} retryTitle="Try again" onRetry={() => void handleAccept()} />
            ) : null}
            <Button
              title={accepting ? 'Accepting…' : 'Accept job'}
              onPress={() => void handleAccept()}
              disabled={accepting}
              loading={accepting}
            />
            <Text variant="caption" color="muted">
              One tap claims the job atomically — if another helper takes it first, you&apos;ll be
              told here and nothing is assigned twice.
            </Text>
          </Card>
        ) : null}

        {job.status === 'assigned' ? (
          <Card>
            <Badge label="Assigned" tone="info" />
            <Text variant="subtitle">Go to the vendor</Text>
            <Text color="secondary">
              Head to {job.vendor.name} to check the food availability and make the purchase.
            </Text>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'go_to_vendor' ? 'Starting…' : 'Go to vendor'}
              onPress={() => void handleAdvance('go_to_vendor')}
              disabled={busy}
              loading={acting === 'go_to_vendor'}
            />
            <Button
              title="Release job"
              variant="danger"
              onPress={() => void handleAdvance('release')}
              disabled={busy}
            />
            <Text variant="caption" color="muted">
              Releasing returns the order to the open queue.
            </Text>
          </Card>
        ) : job.status === 'going_to_vendor' ? (
          <Card>
            <Badge label="Going to vendor" tone="info" />
            <Text variant="subtitle">On the way to {job.vendor.name}</Text>
            <Text color="secondary">
              Let the app know when you arrive at the stall so you can check food availability.
            </Text>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'arrive' ? 'Recording…' : "I'm at the vendor"}
              onPress={() => void handleAdvance('arrive')}
              disabled={busy}
              loading={acting === 'arrive'}
            />
            <Button
              title="Release job"
              variant="danger"
              onPress={() => void handleAdvance('release')}
              disabled={busy}
            />
          </Card>
        ) : job.status === 'at_vendor' ? (
          <Card>
            <Badge label="At vendor" tone="info" />
            <Text variant="subtitle">Check food availability</Text>
            <Text color="secondary">
              Ask the stall if the requested food is available. Report the status below.
            </Text>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'report_food_available' ? 'Recording…' : 'Food available'}
              onPress={() => void handleAdvance('report_food_available')}
              disabled={busy}
              loading={acting === 'report_food_available'}
            />
            <Button
              title="Food unavailable"
              variant="danger"
              onPress={() => void handleAdvance('report_food_unavailable')}
              disabled={busy}
            />
            <Button
              title="Release job"
              variant="secondary"
              onPress={() => void handleAdvance('release')}
              disabled={busy}
            />
          </Card>
        ) : job.status === 'food_available' ? (
          <Card>
            <Badge label="Food available" tone="info" />
            <Text variant="subtitle">Purchase the food</Text>
            <Text color="secondary">
              Pay the stall with your own money, then record the purchase. You front the food cost.
            </Text>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'purchase' ? 'Recording…' : 'Food purchased with my money'}
              onPress={() => void handleAdvance('purchase')}
              disabled={busy}
              loading={acting === 'purchase'}
            />
          </Card>
        ) : job.status === 'food_purchased' ? (
          <Card>
            <Badge label="Purchased" tone="info" />
            <Text variant="subtitle">Verify the pickup</Text>
            <Text color="secondary">
              Enter the order pickup code ({job.pickupCode}) to confirm you physically received the
              food from the stall.
            </Text>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <TextInput
              value={pickupCode}
              onChangeText={setPickupCode}
              placeholder="Pickup code"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              editable={!busy}
              style={styles.codeInput}
              accessibilityLabel="Order pickup code"
            />
            <Button
              title={acting === 'verify_pickup' ? 'Verifying…' : 'Verify pickup'}
              onPress={() => void handleAdvance('verify_pickup', pickupCode)}
              disabled={busy || pickupCode.trim().length === 0}
              loading={acting === 'verify_pickup'}
            />
          </Card>
        ) : job.status === 'picked_up' ? (
          <Card>
            <Badge label="Picked up" tone="info" />
            <Text variant="subtitle">Head to the drop-off</Text>
            <Text color="secondary">
              Food verified in hand. Start the delivery run when you leave for {job.location.name}.
            </Text>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => void handleAdvance('start_delivery')} />
            ) : null}
            <Button
              title={acting === 'start_delivery' ? 'Starting…' : 'Start delivery'}
              onPress={() => void handleAdvance('start_delivery')}
              disabled={busy}
              loading={acting === 'start_delivery'}
            />
          </Card>
        ) : job.status === 'out_for_delivery' ? (
          <Card>
            <Badge label="Out for delivery" tone="warning" />
            <Text variant="subtitle">On the way to {job.location.name}</Text>
            <Text color="secondary">
              Hand the food over, then mark it delivered — the requester pays you after that.
            </Text>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'mark_delivered' ? 'Recording…' : 'Mark delivered'}
              onPress={() => void handleAdvance('mark_delivered')}
              disabled={busy}
              loading={acting === 'mark_delivered'}
            />
            <Button
              title="Requester unavailable"
              variant="danger"
              onPress={() => void handleAdvance('report_failed')}
              disabled={busy}
            />
            <Text variant="caption" color="muted">
              If the requester refuses or never appears, record the failed attempt instead — the
              order moves to dispute with your purchase preserved.
            </Text>
          </Card>
        ) : job.status === 'delivered' ? (
          <Card>
            <Badge label="Delivered" tone="success" />
            <Text color="secondary">
              Food handed over. The requester now pays you {formatMYR(job.subtotalCents + job.deliveryFeeCents)} externally — verify their receipt below.
            </Text>
          </Card>
        ) : job.status === 'awaiting_requester_payment' ? (
          <Card>
            <Badge label="Awaiting payment" tone="warning" />
            <Text variant="subtitle">Waiting for payment</Text>
            <Text color="secondary">
              The requester has submitted their receipt. Verify the payment below.
            </Text>
          </Card>
        ) : job.status === 'completed' ? (
          <Card>
            <Badge label="Completed" tone="success" />
            <Text color="secondary">
              Payment verified. Your {formatMYR(job.deliveryFeeCents)} delivery earning is
              finalized.
            </Text>
          </Card>
        ) : job.status === 'cancelled' ? (
          <Card>
            <Badge label="Cancelled" tone="error" />
            <Text color="secondary">
              {job.cancelReason === 'food_unavailable'
                ? 'The food was unavailable — no money changed hands.'
                : 'This order was cancelled.'}
            </Text>
          </Card>
        ) : job.status === 'disputed' ? (
          <Card>
            <Badge label="Disputed" tone="error" />
            <Text color="secondary">
              This order needs settlement
              {job.foodCostCents ? ` — your fronted ${formatMYR(job.foodCostCents)} is recorded` : ''}.
              An admin will resolve it; nothing more to do here.
            </Text>
          </Card>
        ) : (
          <Card>
            <Text variant="caption" color="muted">
              This job is no longer open.
            </Text>
            <Button title="Back to jobs" variant="secondary" onPress={() => router.back()} />
          </Card>
        )}

        <HelperPaymentCard orderId={job.id} onChanged={() => void reload()} refreshToken={paymentTick} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  vendorName: { fontWeight: '600', color: colors.text },
  itemsCard: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  lineText: { flex: 1, gap: 2 },
  lineName: { fontWeight: '600', color: colors.text },
  lineTotal: { fontWeight: '700', color: colors.primary },
  subtotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  codeInput: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: 'center',
  },
});
