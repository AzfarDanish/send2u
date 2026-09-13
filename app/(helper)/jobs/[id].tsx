import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HelperHistoryDetail } from '@/components/HelperHistoryDetail';
import { OrderBreakdown } from '@/components/OrderBreakdown';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { HelperPaymentCard } from '@/components/HelperPaymentCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, isTerminalOrderStatus, orderStatusLabel, orderStatusTone, orderTotalCents } from '@/lib/orders';
import { acceptOrder, advanceFulfilment, getJobDetail, type FulfilmentAction } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Helper job detail. Review vendor, items, subtotal, and drop-off, then
 * accept. After acceptance, status-driven fulfilment actions walk the order
 * through the physical flow (vendor → purchase → pickup → delivery).
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

  // Reset per-job state during render when the route id changes (the
  // React-endorsed alternative to setState-in-effect); the effect below
  // then only refetches. Inert on mount: the initial values already match
  // the reset values.
  const [seenId, setSeenId] = useState(id);
  if (seenId !== id) {
    setSeenId(id);
    setStatus('loading');
    setJob(null);
    setAcceptError(null);
    setAccepted(false);
    setPaymentTick(0);
    setActionError(null);
  }

  // Mount + id-change fetch. Inlined rather than calling reload(): a
  // useEffect body may not call a state-setting callback
  // (react-hooks/set-state-in-effect) — state sets here live only in the
  // async continuation. reload() stays for realtime/handlers.
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

  // Live updates (requester confirms, pays, cancels, reports, rates…).
  // RLS-scoped to this job; failures fall back to the focus/manual paths.
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
    async (action: FulfilmentAction) => {
      if (!job || acting) return;
      setActing(action);
      setActionError(null);
      try {
        await advanceFulfilment(job.id, action);
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
              onRetry={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(helper)');
              }}
            />
          )}
        </Screen>
      </>
    );
  }

  // Terminal deliveries are historical records: same route, strictly read-only
  // rendering. No accept/advance/verify actions — see HelperHistoryDetail.
  if (isTerminalOrderStatus(job.status)) {
    return (
      <>
        <Stack.Screen options={{ title: `${job.vendor.name} · History` }} />
        <Screen>
          <HelperHistoryDetail job={job} refreshToken={paymentTick} />
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

        <Card>
          <OrderBreakdown
            items={job.items}
            subtotalCents={job.subtotalCents}
            deliveryFeeCents={job.deliveryFeeCents}
          />
          <Text variant="caption" color="muted">
            You pay the stall first; the requester repays food + delivery.
          </Text>
        </Card>

        {accepted ? (
          <Card>
            <View style={styles.confirmRow}>
              <MaterialIcons name="check-circle" size={24} color={colors.success} />
              <Text variant="subtitle">Job accepted — it&apos;s yours</Text>
            </View>
            <Button title="View My Deliveries" onPress={() => router.replace('/(helper)/deliveries')} />
            <Button
              title="Back to jobs"
              variant="secondary"
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(helper)');
              }}
            />
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
          </Card>
        ) : null}

        {job.status === 'assigned' ? (
          <Card>
            <Badge label="Assigned" tone="info" />
            <Text variant="subtitle">Go to the vendor</Text>
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
          </Card>
        ) : job.status === 'going_to_vendor' ? (
          <Card>
            <Badge label="Going to vendor" tone="info" />
            <Text variant="subtitle">On the way to {job.vendor.name}</Text>
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
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'purchase' ? 'Recording…' : 'Food purchased with my money'}
              onPress={() => void handleAdvance('purchase')}
              disabled={busy}
              loading={acting === 'purchase'}
            />
            <Button
              title="Release job"
              variant="secondary"
              onPress={() => void handleAdvance('release')}
              disabled={busy}
            />
            <Text variant="caption" color="muted">
              Nothing spent yet — releasing returns the order to the queue.
            </Text>
          </Card>
        ) : job.status === 'food_purchased' ? (
          <Card>
            <Badge label="Purchased" tone="info" />
            <Text variant="subtitle">Confirm you have the food</Text>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
            ) : null}
            <Button
              title={acting === 'mark_picked_up' ? 'Recording…' : 'Confirm pickup'}
              onPress={() => void handleAdvance('mark_picked_up')}
              disabled={busy}
              loading={acting === 'mark_picked_up'}
            />
            <Button
              title={acting === 'abandon' ? 'Recording…' : "Can't complete this job"}
              variant="danger"
              onPress={() => void handleAdvance('abandon')}
              disabled={busy}
              loading={acting === 'abandon'}
            />
            <Text variant="caption" color="muted">
              Stopping here moves the order to dispute; your fronted cost is recorded.
            </Text>
          </Card>
        ) : job.status === 'picked_up' ? (
          <Card>
            <Badge label="Picked up" tone="info" />
            <Text variant="subtitle">Head to the drop-off</Text>
            {actionError ? (
              <ErrorState title="Update failed" message={actionError} retryTitle="Dismiss" onRetry={() => void handleAdvance('start_delivery')} />
            ) : null}
            <Button
              title={acting === 'start_delivery' ? 'Starting…' : 'Start delivery'}
              onPress={() => void handleAdvance('start_delivery')}
              disabled={busy}
              loading={acting === 'start_delivery'}
            />
            <Button
              title={acting === 'abandon' ? 'Recording…' : "Can't complete this job"}
              variant="danger"
              onPress={() => void handleAdvance('abandon')}
              disabled={busy}
              loading={acting === 'abandon'}
            />
            <Text variant="caption" color="muted">
              Stopping here moves the order to dispute; your fronted cost is recorded.
            </Text>
          </Card>
        ) : job.status === 'out_for_delivery' ? (
          <Card>
            <Badge label="Out for delivery" tone="warning" />
            <Text variant="subtitle">On the way to {job.location.name}</Text>
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
              No-show moves the order to dispute; your purchase is recorded.
            </Text>
          </Card>
        ) : job.status === 'delivered' ? (
          <Card>
            <Badge label="Delivered" tone="success" />
            <Text color="secondary">
              Waiting for the requester to confirm receipt.
            </Text>
          </Card>
        ) : job.status === 'confirmed' ? (
          <Card>
            <Badge label="Confirmed" tone="success" />
            <Text variant="subtitle">Requester confirmed receipt</Text>
            <Text color="secondary">
              They pay you {formatMYR(orderTotalCents(job.subtotalCents, job.deliveryFeeCents))} externally
              using your QR.
            </Text>
          </Card>
        ) : (
          <Card>
            <Text variant="caption" color="muted">
              This job is no longer open.
            </Text>
            <Button
              title="Back to jobs"
              variant="secondary"
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(helper)');
              }}
            />
          </Card>
        )}

        <HelperPaymentCard orderId={job.id} refreshToken={paymentTick} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, gap: spacing.xs },
  vendorName: { fontWeight: '600', color: colors.text },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
