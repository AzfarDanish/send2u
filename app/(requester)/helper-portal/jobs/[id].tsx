import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { HelperHistoryDetail } from '@/components/HelperHistoryDetail';
import { HelperPaymentCard } from '@/components/HelperPaymentCard';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { openMapsLocation } from '@/lib/maps';
import { formatMYR } from '@/lib/money';
import { emitOrderChanged } from '@/lib/orderEvents';
import { formatOrderDate, isTerminalOrderStatus, orderStatusLabel, orderStatusTone, orderTotalCents } from '@/lib/orders';
import { acceptOrder, advanceFulfilment, getJobDetail, type FulfilmentAction } from '@/services/orders';
import type { OrderStatus, OrderWithDetails } from '@/types/domain';

/** States where the helper still needs the item list open (deciding/buying). */
const PRE_PURCHASE: ReadonlySet<OrderStatus> = new Set([
  'pending',
  'assigned',
  'going_to_vendor',
  'at_vendor',
  'food_available',
]);

/** Which location the current state is about — the other stays a quiet line. */
function locationEmphasis(status: OrderStatus): 'pickup' | 'dropoff' | 'none' {
  switch (status) {
    case 'assigned':
    case 'going_to_vendor':
    case 'at_vendor':
    case 'food_available':
    case 'food_purchased':
      return 'pickup';
    case 'picked_up':
    case 'out_for_delivery':
      return 'dropoff';
    default:
      return 'none';
  }
}

/**
 * Delivery Workspace inside Helper Portal. Same atomic state machine as the
 * legacy helper job screen (pending → assigned → … → delivered → confirmed
 * → completed, plus release/abandon/report branches); the hierarchy is
 * task-first: state + next step lead, the action follows immediately,
 * location emphasis tracks the state, and the order breakdown is
 * progressively disclosed. External-maps handoff only — no embedded map.
 */
export default function PortalJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<OrderWithDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [paymentTick, setPaymentTick] = useState(0);
  const [acting, setActing] = useState<FulfilmentAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mapsBusy, setMapsBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState<boolean | null>(null);

  const reload = useCallback(async () => {
    try {
      const found = typeof id === 'string' ? await getJobDetail(id) : null;
      setJob(found);
      setStatus(found ? 'ready' : 'missing');
    } catch {
      setJob(null);
      setStatus('missing');
    }
  }, [id]);

  const [seenId, setSeenId] = useState(id);
  if (seenId !== id) {
    setSeenId(id);
    setStatus('loading');
    setJob(null);
    setAcceptError(null);
    setAccepted(false);
    setPaymentTick(0);
    setActionError(null);
    setDetailsOpen(null);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const found = typeof id === 'string' ? await getJobDetail(id) : null;
        if (mounted) {
          setJob(found);
          setStatus(found ? 'ready' : 'missing');
        }
      } catch {
        if (mounted) {
          setJob(null);
          setStatus('missing');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  useRealtimeReload(
    typeof id === 'string'
      ? [
          { table: 'send2u_orders', filter: `id=eq.${id}` },
          { table: 'send2u_ratings', filter: `order_id=eq.${id}` },
        ]
      : [],
    () => {
      void reload();
      setPaymentTick((t) => t + 1);
    },
  );

  const handleAccept = useCallback(async () => {
    if (!job || accepting) return;
    const previous = job;
    setAccepting(true);
    setAcceptError(null);
    try {
      const result = await acceptOrder(job.id);
      const patched = { ...previous, status: result.status };
      setJob(patched);
      emitOrderChanged(patched);
      setAccepted(true);
      setPaymentTick((t) => t + 1);
    } catch (err) {
      setJob(previous);
      setAcceptError(err instanceof Error ? err.message : 'Could not accept the job.');
    } finally {
      setAccepting(false);
    }
  }, [job, accepting]);

  const handleAdvance = useCallback(
    async (action: FulfilmentAction) => {
      if (!job || acting) return;
      const previous = job;
      setActing(action);
      setActionError(null);
      try {
        const result = await advanceFulfilment(job.id, action);
        const patched = { ...previous, status: result.status };
        setJob(patched);
        emitOrderChanged(patched);
        setPaymentTick((t) => t + 1);
        setDetailsOpen(null);
      } catch (err) {
        setJob(previous);
        setActionError(err instanceof Error ? err.message : 'Could not update the order.');
      } finally {
        setActing(null);
      }
    },
    [job, acting],
  );

  const openMaps = useCallback(async (label: string) => {
    if (mapsBusy) return;
    setMapsBusy(true);
    try {
      await openMapsLocation(label);
    } finally {
      setMapsBusy(false);
    }
  }, [mapsBusy]);

  if (status === 'loading' || !job) {
    return (
      <HelperPortalGuard title="Delivery">
        <GlassHeader title="Delivery" fallbackHref="/(requester)/helper-portal" />
        <Screen beneathHeader>
          {status === 'loading' ? (
            <LoadingState message="Loading job…" />
          ) : (
            <ErrorState
              title="Job not available"
              message="This request is no longer open. It may have been taken by another helper."
              retryTitle="Back to portal"
              onRetry={() => router.replace('/(requester)/helper-portal')}
            />
          )}
        </Screen>
      </HelperPortalGuard>
    );
  }

  if (isTerminalOrderStatus(job.status)) {
    return (
      <HelperPortalGuard title="Delivery record">
        <GlassHeader title="Delivery record" fallbackHref="/(requester)/helper-portal/deliveries" />
        <Screen beneathHeader>
          <HelperHistoryDetail job={job} refreshToken={paymentTick} />
        </Screen>
      </HelperPortalGuard>
    );
  }

  const pending = job.status === 'pending' && !accepted;
  const busy = acting !== null;
  const pickupLabel = job.vendor.locationHint ?? job.vendor.name;
  const dropoffLabel = job.location.name;
  const emphasis = locationEmphasis(job.status);
  const showDetails = detailsOpen ?? PRE_PURCHASE.has(job.status);
  const itemCount = job.items.reduce((sum, item) => sum + item.quantity, 0);

  const taskTitle =
    job.status === 'pending'
      ? 'Review this request'
      : job.status === 'assigned'
        ? 'Go to the vendor'
        : job.status === 'going_to_vendor'
          ? `On the way to ${job.vendor.name}`
          : job.status === 'at_vendor'
            ? 'Check food availability'
            : job.status === 'food_available'
              ? 'Purchase the food'
              : job.status === 'food_purchased'
                ? 'Confirm you have the food'
                : job.status === 'picked_up'
                  ? 'Head to the drop-off'
                  : job.status === 'out_for_delivery'
                    ? `On the way to ${job.location.name}`
                    : job.status === 'delivered'
                      ? 'Waiting for confirmation'
                      : job.status === 'confirmed'
                        ? 'Requester confirmed receipt'
                        : 'Job closed';

  return (
    <HelperPortalGuard title="Delivery">
      <GlassHeader title={job.vendor.name} fallbackHref="/(requester)/helper-portal" />
      <Screen beneathHeader>
        <View style={styles.taskHeader}>
          <View style={styles.taskRow}>
            <Badge
              label={accepted && job.status === 'pending' ? 'Assigned' : orderStatusLabel(job.status)}
              tone={accepted && job.status === 'pending' ? 'success' : orderStatusTone(job.status)}
            />
            <Text variant="caption" color="secondary">
              Requested {formatOrderDate(job.createdAt)}
            </Text>
          </View>
          <Text variant="title">{taskTitle}</Text>
          {accepted ? (
            <View style={styles.acceptedLine}>
              <MaterialIcons name="check-circle" size={20} color={colors.success} />
              <Text variant="secondary" color="secondary">
                Accepted — this job is yours
              </Text>
            </View>
          ) : null}
        </View>

        {pending ? (
          <View style={styles.actions}>
            {acceptError ? (
              <ErrorState title="Could not accept" message={acceptError} retryTitle="Try again" onRetry={() => void handleAccept()} />
            ) : null}
            <Button
              title={accepting ? 'Accepting…' : `Accept · +${formatMYR(job.deliveryFeeCents)} fee`}
              onPress={() => void handleAccept()}
              disabled={accepting}
              loading={accepting}
            />
          </View>
        ) : null}

        {job.status === 'assigned' ? (
          <View style={styles.actions}>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'go_to_vendor' ? 'Starting…' : 'Go to vendor'}
              onPress={() => void handleAdvance('go_to_vendor')}
              disabled={busy}
              loading={acting === 'go_to_vendor'}
            />
            <Button title="Release job" variant="tertiary" onPress={() => void handleAdvance('release')} disabled={busy} />
          </View>
        ) : job.status === 'going_to_vendor' ? (
          <View style={styles.actions}>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'arrive' ? 'Recording…' : "I'm at the vendor"}
              onPress={() => void handleAdvance('arrive')}
              disabled={busy}
              loading={acting === 'arrive'}
            />
            <Button title="Release job" variant="tertiary" onPress={() => void handleAdvance('release')} disabled={busy} />
          </View>
        ) : job.status === 'at_vendor' ? (
          <View style={styles.actions}>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'report_food_available' ? 'Recording…' : 'Food available'}
              onPress={() => void handleAdvance('report_food_available')}
              disabled={busy}
              loading={acting === 'report_food_available'}
            />
            <View style={styles.secondaryRow}>
              <Button title="Food unavailable" variant="danger" onPress={() => void handleAdvance('report_food_unavailable')} disabled={busy} />
              <Button title="Release job" variant="tertiary" onPress={() => void handleAdvance('release')} disabled={busy} />
            </View>
          </View>
        ) : job.status === 'food_available' ? (
          <View style={styles.actions}>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'purchase' ? 'Recording…' : 'Food purchased with my money'}
              onPress={() => void handleAdvance('purchase')}
              disabled={busy}
              loading={acting === 'purchase'}
            />
            <Text variant="caption" color="muted">
              Nothing spent yet — releasing returns the order to the queue.
            </Text>
            <Button title="Release job" variant="tertiary" onPress={() => void handleAdvance('release')} disabled={busy} />
          </View>
        ) : job.status === 'food_purchased' ? (
          <View style={styles.actions}>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'mark_picked_up' ? 'Recording…' : 'Confirm pickup'}
              onPress={() => void handleAdvance('mark_picked_up')}
              disabled={busy}
              loading={acting === 'mark_picked_up'}
            />
            <Text variant="caption" color="muted">
              Stopping here moves the order to dispute; your fronted cost is recorded.
            </Text>
            <Button
              title={acting === 'abandon' ? 'Recording…' : "Can't complete this job"}
              variant="danger"
              onPress={() => void handleAdvance('abandon')}
              disabled={busy}
              loading={acting === 'abandon'}
            />
          </View>
        ) : job.status === 'picked_up' ? (
          <View style={styles.actions}>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'start_delivery' ? 'Starting…' : 'Start delivery'}
              onPress={() => void handleAdvance('start_delivery')}
              disabled={busy}
              loading={acting === 'start_delivery'}
            />
            <Text variant="caption" color="muted">
              Stopping here moves the order to dispute; your fronted cost is recorded.
            </Text>
            <Button
              title={acting === 'abandon' ? 'Recording…' : "Can't complete this job"}
              variant="danger"
              onPress={() => void handleAdvance('abandon')}
              disabled={busy}
              loading={acting === 'abandon'}
            />
          </View>
        ) : job.status === 'out_for_delivery' ? (
          <View style={styles.actions}>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'mark_delivered' ? 'Recording…' : 'Mark delivered'}
              onPress={() => void handleAdvance('mark_delivered')}
              disabled={busy}
              loading={acting === 'mark_delivered'}
            />
            <Text variant="caption" color="muted">
              No-show moves the order to dispute; your purchase is recorded.
            </Text>
            <Button title="Requester unavailable" variant="danger" onPress={() => void handleAdvance('report_failed')} disabled={busy} />
          </View>
        ) : job.status === 'delivered' ? (
          <View style={styles.actions}>
            <Text color="secondary">Waiting for the requester to confirm receipt.</Text>
          </View>
        ) : job.status === 'confirmed' ? (
          <View style={styles.actions}>
            <Text color="secondary">
              They pay you {formatMYR(orderTotalCents(job.subtotalCents, job.deliveryFeeCents))} externally
              using your QR.
            </Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <Text variant="caption" color="muted">
              This job is no longer open.
            </Text>
            <Button
              title="Back to portal"
              variant="secondary"
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(requester)/helper-portal');
              }}
            />
          </View>
        )}

        <View style={styles.group}>
          {emphasis === 'pickup' ? (
            <>
              <View style={styles.placeRow}>
                <MaterialIcons name="storefront" size={20} color={colors.primary} />
                <View style={styles.placeText}>
                  <Text variant="secondary" style={styles.placeTitle}>
                    Pick up · {job.vendor.name}
                  </Text>
                  {job.vendor.locationHint ? (
                    <Text variant="caption" color="secondary">
                      {job.vendor.locationHint}
                    </Text>
                  ) : null}
                </View>
                <Button
                  title="Open Maps"
                  variant="secondary"
                  onPress={() => void openMaps(pickupLabel)}
                  disabled={mapsBusy}
                />
              </View>
              <Text variant="caption" color="muted">
                Drop off · {job.location.name}
              </Text>
            </>
          ) : emphasis === 'dropoff' ? (
            <>
              <Text variant="caption" color="muted">
                Picked up · {job.vendor.name}
              </Text>
              <View style={styles.placeRow}>
                <MaterialIcons name="place" size={20} color={colors.primary} />
                <View style={styles.placeText}>
                  <Text variant="secondary" style={styles.placeTitle}>
                    Drop off · {job.location.name}
                  </Text>
                </View>
                <Button
                  title="Open Maps"
                  variant="secondary"
                  onPress={() => void openMaps(dropoffLabel)}
                  disabled={mapsBusy}
                />
              </View>
            </>
          ) : (
            <>
              <Text variant="caption" color="secondary">
                Pick up · {job.vendor.locationHint ?? job.vendor.name}
              </Text>
              <Text variant="caption" color="secondary">
                Drop off · {job.location.name}
              </Text>
            </>
          )}
        </View>

        <View style={styles.group}>
          <Button
            title={showDetails ? 'Hide order details' : `Order details · ${itemCount} item${itemCount === 1 ? '' : 's'} · ${formatMYR(orderTotalCents(job.subtotalCents, job.deliveryFeeCents))}`}
            variant="tertiary"
            onPress={() => setDetailsOpen(!showDetails)}
          />
          {showDetails ? (
            <>
              <OrderBreakdown
                items={job.items}
                subtotalCents={job.subtotalCents}
                deliveryFeeCents={job.deliveryFeeCents}
              />
              <Text variant="caption" color="muted">
                You front the food cost; the +{formatMYR(job.deliveryFeeCents)} fee is your earning.
              </Text>
            </>
          ) : null}
        </View>

        <HelperPaymentCard orderId={job.id} refreshToken={paymentTick} />
      </Screen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  taskHeader: { gap: spacing.sm, paddingBottom: spacing.sm },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  acceptedLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  secondaryRow: { gap: spacing.xs },
  group: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  placeText: { flex: 1, gap: spacing.xs },
  placeTitle: { fontWeight: '600', color: colors.text },
});
