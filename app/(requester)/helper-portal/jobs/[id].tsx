import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { HeaderBell } from '@/components/HeaderBell';
import { HelperHistoryDetail } from '@/components/HelperHistoryDetail';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { PlaceholderImage } from '@/components/PlaceholderImage';
import { VendorMark } from '@/components/VendorMark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useMyDeliveries } from '@/hooks/useMyDeliveries';
import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { openMapsLocation } from '@/lib/maps';
import { formatMYR } from '@/lib/money';
import { emitOrderChanged } from '@/lib/orderEvents';
import { isTerminalOrderStatus, MAX_ACTIVE_JOBS_PER_HELPER, orderTotalCents } from '@/lib/orders';
import { acceptOrder, advanceFulfilment, getJobDetail, type FulfilmentAction } from '@/services/orders';
import { confirmCodCollection } from '@/services/payments';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Product stages presented to the Helper. The backend keeps finer states
 * underneath (e.g. going_to_vendor vs at_vendor); the UI groups them so
 * the Helper answers one real-world question per screen.
 */
type WorkspaceStage = 'go' | 'collect' | 'deliver' | 'confirm' | 'done';

function stageFor(status: string): WorkspaceStage | null {
  switch (status) {
    case 'assigned':
    case 'preparing':
    case 'ready_for_pickup':
    case 'going_to_vendor':
      return 'go';
    case 'at_vendor':
    case 'food_available':
    case 'food_purchased':
      return 'collect';
    case 'picked_up':
      return 'deliver';
    case 'out_for_delivery':
      return 'confirm';
    case 'delivered':
    case 'confirmed':
      return 'done';
    default:
      return null;
  }
}

/** Next collect-chain RPC for a status, or null when the chain is done. */
const COLLECT_NEXT: Record<string, FulfilmentAction | null> = {
  at_vendor: 'report_food_available',
  food_available: 'purchase',
  food_purchased: 'mark_picked_up',
};

/** Step position within the five Helper stages (accept, go, collect, deliver, confirm). */
const STAGE_STEP: Record<Exclude<WorkspaceStage, 'done'>, number> = {
  go: 1,
  collect: 2,
  deliver: 3,
  confirm: 4,
};
const TOTAL_STEPS = 5;

/** Segmented progress: plain caption plus one segment per product stage. */
function StageProgress({ step }: { step: number }) {
  return (
    <View>
      <Text variant="caption" color="secondary">
        Step {step} of {TOTAL_STEPS}
      </Text>
      <View style={styles.progressTrack}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[styles.progressSeg, i < step ? styles.progressSegFilled : styles.progressSegEmpty]}
          />
        ))}
      </View>
    </View>
  );
}

/** Location block with a compact external-Maps chip (whole chip opens Maps). */
function StageWayBlock({
  icon,
  heading,
  title,
  detail,
  mapsLabel,
  onOpen,
  mapsDisabled,
}: {
  icon: 'storefront' | 'place';
  heading: string;
  title: string;
  detail?: string | null;
  mapsLabel: string;
  onOpen: (label: string) => void;
  mapsDisabled: boolean;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.sectionHead}>
        <MaterialIcons name={icon} size={20} color={colors.primary} />
        <Text variant="subtitle">{heading}</Text>
      </View>
      <View style={styles.feeRow}>
        <View style={styles.waypointText}>
          <Text variant="secondary" style={styles.waypointTitle} numberOfLines={2}>
            {title}
          </Text>
          {detail ? (
            <Text color="secondary" numberOfLines={3}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open in Maps: ${mapsLabel}`}
          onPress={() => onOpen(mapsLabel)}
          disabled={mapsDisabled}
          style={({ pressed }) => [styles.navChip, pressed && styles.pressed]}>
          <MaterialIcons name="navigation" size={20} color={colors.primary} />
          <Text variant="caption" style={styles.navLabel}>
            Navigate
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

/** Compact order preview: small visuals, item lines, optional fee line. */
function StageOrderPreview({ job, showFee }: { job: OrderWithDetails; showFee?: boolean }) {
  return (
    <Card style={styles.card}>
      <View style={styles.sectionHead}>
        <MaterialIcons name="receipt-long" size={20} color={colors.primary} />
        <Text variant="subtitle">Order items</Text>
      </View>
      {job.items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <VendorMark name={job.vendor.name} size={48} />
          <View style={styles.itemText}>
            <Text variant="secondary" style={styles.waypointTitle} numberOfLines={1}>
              {item.itemName}
            </Text>
            <Text color="secondary" numberOfLines={1}>
              {item.quantity} × {formatMYR(item.unitPriceCents)}
            </Text>
          </View>
          <Text variant="secondary" style={styles.waypointTitle}>
            {formatMYR(item.lineTotalCents)}
          </Text>
        </View>
      ))}
      {showFee ? (
        <View style={styles.feeRow}>
          <Text variant="secondary">Your delivery fee</Text>
          <Text variant="price" style={[styles.feeAmount, styles.feeEarn]}>
            +{formatMYR(job.deliveryFeeCents)}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Subtle five-dot workflow marker: dots before `step` read as done, the
 * dot for `step` is the active one. No step-count text — the marker stays
 * subordinate to the task itself.
 */
function StageDots({ step, label }: { step: number; label: string }) {
  return (
    <View accessibilityRole="text" accessibilityLabel={label} style={styles.dots}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i < step ? styles.dotDone : styles.dotTodo, i === step - 1 ? styles.dotActive : null]}
        />
      ))}
    </View>
  );
}

/** Shared drop-off block for the deliver/confirm stages: name, description, Maps chip. */
function WorkspaceDeliverTo({
  job,
  mapsLabel,
  onOpen,
  mapsDisabled,
}: {
  job: OrderWithDetails;
  mapsLabel: string;
  onOpen: (label: string) => void;
  mapsDisabled: boolean;
}) {
  return (
    <Card style={styles.card}>
      <Text variant="subtitle">Deliver to</Text>
      <View style={styles.feeRow}>
        <View style={styles.itemText}>
          <Text variant="secondary" style={styles.waypointTitle} numberOfLines={2}>
            {job.location.name}
          </Text>
          {job.location.description ? (
            <Text color="secondary" numberOfLines={3}>
              {job.location.description}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open in Maps: ${mapsLabel}`}
          onPress={() => onOpen(mapsLabel)}
          disabled={mapsDisabled}
          style={({ pressed }) => [styles.navChip, pressed && styles.pressed]}>
          <MaterialIcons name="navigation" size={20} color={colors.primary} />
          <Text variant="caption" style={styles.navLabel}>
            Navigate
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

/** Shared order-items block for the collect/deliver stages: 44pt thumbs, no heroes, no icons. */
function WorkspaceOrderItems({ job }: { job: OrderWithDetails }) {
  return (
    <Card style={styles.card}>
      <Text variant="subtitle">Order items</Text>
      {job.items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <PlaceholderImage style={styles.thumb} />
          <View style={styles.itemText}>
            <Text variant="secondary" style={styles.waypointTitle} numberOfLines={2}>
              {item.itemName}
            </Text>
            <Text color="secondary" numberOfLines={1}>
              {item.quantity} × {formatMYR(item.unitPriceCents)}
            </Text>
          </View>
          <Text variant="secondary" style={styles.waypointTitle}>
            {formatMYR(item.lineTotalCents)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/** Inline danger confirm for exception paths (never beside the primary). */
function ExceptionConfirm({
  message,
  confirmTitle,
  confirming,
  disabled,
  onConfirm,
  onDismiss,
}: {
  message: string;
  confirmTitle: string;
  confirming: boolean;
  disabled: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.confirmPanel}>
      <Text color="secondary">{message}</Text>
      <Button
        title={confirming ? 'Working…' : confirmTitle}
        variant="danger"
        onPress={onConfirm}
        disabled={disabled}
        loading={confirming}
      />
      <Button title="Keep this job" variant="secondary" onPress={onDismiss} disabled={disabled} />
    </View>
  );
}

/** Terminal-for-helper result: what happened, what was earned, no actions. */
function CompletionResult({ job, staysForCash }: { job: OrderWithDetails; staysForCash?: boolean }) {
  const itemCount = job.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Card style={[styles.card, styles.doneCard]}>
      <View accessibilityRole="image" accessibilityLabel="Delivery completed" style={styles.doneEmblem}>
        <MaterialIcons name="check" size={36} color={colors.success} />
      </View>
      <Text variant="title" style={styles.doneCenter}>
        Delivery completed
      </Text>
      <Text color="secondary" style={styles.doneCenter}>
        {itemCount} {itemCount === 1 ? 'item' : 'items'} · {job.location.name}
      </Text>
      <Text variant="price" style={[styles.doneCenter, styles.feeEarn]}>
        +{formatMYR(job.deliveryFeeCents)} delivery fee
      </Text>
      <Text variant="caption" color="muted" style={styles.doneCenter}>
        {staysForCash ? 'Confirm the cash collection below.' : 'Returning to your deliveries…'}
      </Text>
    </Card>
  );
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
  const [collecting, setCollecting] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const [confirmKind, setConfirmKind] = useState<null | 'unavailable' | 'abandon'>(null);
  const mountedRef = useRef(true);
  // Active-delivery count gates acceptance at the 3-job capacity (the
  // server enforces the same cap race-safely; this only shapes the UI).
  const myDeliveries = useMyDeliveries();
  const activeCount =
    myDeliveries.status === 'ready' ? myDeliveries.deliveries.length : 0;
  const atCapacity = activeCount >= MAX_ACTIVE_JOBS_PER_HELPER;

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
    setCollecting(false);
    setCashingOut(false);
    setConfirmKind(null);
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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const navigation = useNavigation();
  // Go, Collect, Deliver, and Confirm own their workflow: no back chevron,
  // no bell, and the OS back gesture is held while these stages are active.
  const navLocked =
    stageFor(job?.status ?? '') === 'go' ||
    stageFor(job?.status ?? '') === 'collect' ||
    stageFor(job?.status ?? '') === 'deliver' ||
    stageFor(job?.status ?? '') === 'confirm';
  useEffect(() => {
    if (!navLocked) return;
    const sub = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
    });
    return () => sub();
  }, [navigation, navLocked]);

  useRealtimeReload(
    typeof id === 'string'
      ? [
          { table: 'send2u_orders', filter: `id=eq.${id}` },
          { table: 'send2u_payments', filter: `order_id=eq.${id}` },
          { table: 'send2u_settlements', filter: `order_id=eq.${id}` },
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
      setConfirmKind(null);
      try {
        const result = await advanceFulfilment(job.id, action);
        if ('deleted' in result) {
          // Pre-purchase unavailable-food path removes the order row: there
          // is nothing left to display. Land on Deliveries; realtime and
          // list reloads reconcile everywhere else.
          router.replace('/(requester)/helper-portal/deliveries');
          return;
        }
        const patched = { ...previous, status: result.status };
        setJob(patched);
        emitOrderChanged(patched);
        setPaymentTick((t) => t + 1);
        if (result.status === 'delivered') {
          // Handoff done: show the completion result, then return to the
          // delivery list — unless COD cash is still unrecorded, in which
          // case the helper stays to confirm the collection. Guarded so a
          // manual exit wins over the timer.
          const staysForCash =
            previous.paymentMethod === 'cod' && previous.paymentStatus !== 'collected';
          if (!staysForCash) {
            setTimeout(() => {
              if (mountedRef.current) router.replace('/(requester)/helper-portal/deliveries');
            }, 3500);
          }
        }
      } catch (err) {
        setJob(previous);
        setActionError(err instanceof Error ? err.message : 'Could not update the order.');
      } finally {
        setActing(null);
      }
    },
    [job, acting],
  );

  /**
   * One meaningful "collect food" confirmation. Runs the backend chain
   * (availability → platform-covered collection → pickup) step by step from
   * the live status, reloading at the end; any failure stops the chain with
   * the backend error surfaced, and retrying resumes from actual state.
   * The helper never pays: the food is covered by Send2U.
   */
  const runCollectChain = useCallback(async () => {
    if (!job || collecting) return;
    if (!COLLECT_NEXT[job.status]) return;
    setCollecting(true);
    setActionError(null);
    setConfirmKind(null);
    try {
      let snapshot = job;
      let current = job.status;
      for (let i = 0; i < 3; i++) {
        const action = COLLECT_NEXT[current];
        if (!action) break;
        const result = await advanceFulfilment(job.id, action);
        // Defensive: the chained actions never delete, but a deleted row
        // must not be patched with an undefined status.
        if ('deleted' in result) {
          await reload();
          return;
        }
        current = result.status;
        snapshot = { ...snapshot, status: current };
        setJob(snapshot);
        emitOrderChanged(snapshot);
      }
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the order.');
    } finally {
      setCollecting(false);
    }
  }, [job, collecting, reload]);

  const openMaps = useCallback(async (label: string) => {
    if (mapsBusy) return;
    setMapsBusy(true);
    try {
      await openMapsLocation(label);
    } finally {
      setMapsBusy(false);
    }
  }, [mapsBusy]);

  /**
   * COD cash collection: records the customer handover as a platform
   * transaction event. Amount comes from the database — the helper only
   * confirms. Idempotent: double taps return the same collected state.
   */
  const handleCollectCash = useCallback(async () => {
    if (!job || cashingOut) return;
    const previous = job;
    setCashingOut(true);
    setActionError(null);
    try {
      const result = await confirmCodCollection(job.id);
      const patched: OrderWithDetails = {
        ...previous,
        paymentStatus: result.status,
        codCollectedCents: result.amountCents,
      };
      setJob(patched);
      emitOrderChanged(patched);
      setPaymentTick((t) => t + 1);
      await reload();
    } catch (err) {
      setJob(previous);
      setActionError(err instanceof Error ? err.message : 'Could not record cash collection.');
    } finally {
      setCashingOut(false);
    }
  }, [job, cashingOut, reload]);

  if (status === 'loading' || !job) {
    return (
      <HelperPortalGuard title="Delivery">
        <GlassHeader title="Delivery" fallbackHref="/(requester)" right={<HeaderBell />} />
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
        <GlassHeader title="Delivery record" fallbackHref="/(requester)" right={<HeaderBell />} />
        <Screen beneathHeader>
          <HelperHistoryDetail job={job} refreshToken={paymentTick} />
        </Screen>
      </HelperPortalGuard>
    );
  }

  const busy = acting !== null;
  const pickupLabel = job.vendor.locationHint ?? job.vendor.name;
  const dropoffLabel = job.location.name;

  // Decision mode: an open job under review (pending, or already prepared
  // by the cafeteria awaiting a collector). Visual → route → order →
  // fee → commitment, with everything on screen and nothing hidden.
  // Once claimed, the same screen becomes the task-first workspace below.
  if (!accepted && !job.helperId &&
    (job.status === 'pending' || job.status === 'preparing' || job.status === 'ready_for_pickup')) {
    return (
      <HelperPortalGuard title="Job Details">
        <GlassHeader title="Job Details" fallbackHref="/(requester)" />
        <Screen beneathHeader scrollable={false} contentStyle={styles.shell}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}>
            <View>
              <Text variant="title" numberOfLines={2}>
                {job.vendor.name}
              </Text>
            </View>

            <WorkspaceOrderItems job={job} />

            <Card style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open pickup location in Maps: ${pickupLabel}`}
                onPress={() => void openMaps(pickupLabel)}
                disabled={mapsBusy}
                style={({ pressed }) => [styles.locBlock, pressed && styles.pressed]}>
                <View style={styles.locText}>
                  <Text variant="caption" color="secondary">
                    Pick up from
                  </Text>
                  <Text variant="secondary" style={styles.waypointTitle} numberOfLines={2}>
                    {job.vendor.name}
                  </Text>
                  {job.vendor.locationHint ? (
                    <Text color="secondary" numberOfLines={3}>
                      {job.vendor.locationHint}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </Card>

            <Card style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open delivery location in Maps: ${dropoffLabel}`}
                onPress={() => void openMaps(dropoffLabel)}
                disabled={mapsBusy}
                style={({ pressed }) => [styles.locBlock, pressed && styles.pressed]}>
                <View style={styles.locText}>
                  <Text variant="caption" color="secondary">
                    Deliver to
                  </Text>
                  <Text variant="secondary" style={styles.waypointTitle} numberOfLines={2}>
                    {job.location.name}
                  </Text>
                  {job.location.description ? (
                    <Text color="secondary" numberOfLines={3}>
                      {job.location.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </Card>

            <Card style={styles.card}>
              <View style={styles.moneyRow}>
                <Text color="secondary">Your delivery fee</Text>
                <Text variant="price" style={styles.feeEarn}>
                  +{formatMYR(job.deliveryFeeCents)}
                </Text>
              </View>
              <Text variant="caption" color="secondary">
                {activeCount} of {MAX_ACTIVE_JOBS_PER_HELPER} active jobs ·{' '}
                {atCapacity ? 'Finish one to take another.' : 'You can accept this job.'}
              </Text>
              <Text variant="caption" color="secondary">
                {job.paymentMethod === 'cod'
                  ? `Cash on delivery — collect ${formatMYR(orderTotalCents(job.subtotalCents, job.deliveryFeeCents))} from the customer.`
                  : 'Online payment — the food is covered by Send2U. Just collect and deliver.'}
              </Text>
            </Card>
          </ScrollView>
          <View style={styles.footer}>
            {acceptError ? (
              <ErrorState title="Could not accept" message={acceptError} retryTitle="Try again" onRetry={() => void handleAccept()} />
            ) : null}
            <SlideToConfirm
              tone="filled"
              label="Slide to accept"
              busyLabel="Accepting…"
              disabledLabel={`Full — ${activeCount}/${MAX_ACTIVE_JOBS_PER_HELPER} active`}
              disabled={atCapacity}
              busy={accepting}
              onConfirm={() => void handleAccept()}
            />
          </View>
        </Screen>
      </HelperPortalGuard>
    );
  }

  const stage = stageFor(job.status);
  const foodCents = job.foodCostCents ?? job.subtotalCents;
  // Exception paths mirror exactly what the backend permits per state.
  // There is deliberately no release path on the collect screen.
  const canReportUnavailable = job.status === 'at_vendor' || job.status === 'food_available';
  const canAbandon = job.status === 'food_purchased' || job.status === 'picked_up';

  const actionFailed = actionError ? (
    <ErrorState
      title="Update failed"
      message={actionError}
      retryTitle="Dismiss"
      onRetry={() => setActionError(null)}
    />
  ) : null;

  const confirmPanel =
    confirmKind === 'unavailable' ? (
      <ExceptionConfirm
        message="The vendor doesn't have this food. This delivery will be cancelled and kept for the record. You haven't paid anything, so there's nothing to settle."
        confirmTitle="Cancel this delivery"
        confirming={acting === 'report_food_unavailable'}
        disabled={busy}
        onConfirm={() => void handleAdvance('report_food_unavailable')}
        onDismiss={() => setConfirmKind(null)}
      />
    ) : confirmKind === 'abandon' ? (
      <ExceptionConfirm
        message="Stopping now moves the order to a dispute for review. The food stays covered by Send2U — you never pay for it."
        confirmTitle="Stop delivery"
        confirming={acting === 'abandon'}
        disabled={busy}
        onConfirm={() => void handleAdvance('abandon')}
        onDismiss={() => setConfirmKind(null)}
      />
    ) : null;

  // Subordinate unavailable-food entry, rendered BELOW the fixed footer so it
  // can never be mistaken for the primary path or tapped accidentally. Only
  // offered pre-purchase (at_vendor/food_available), where the backend
  // permits `report_food_unavailable`; nothing changes until confirmed.
  const belowFoot =
    stage === 'collect' && !confirmKind && canReportUnavailable ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Report food unavailable"
        accessibilityHint="Opens a confirmation. Nothing changes until you confirm."
        accessibilityState={{ disabled: busy || collecting }}
        onPress={() => setConfirmKind('unavailable')}
        disabled={busy || collecting}
        style={({ pressed }) => [styles.exceptionLink, pressed && styles.pressed]}>
        <Text color={busy || collecting ? 'muted' : 'secondary'}>Food not available?</Text>
      </Pressable>
    ) : null;

  let body: ReactNode = null;
  let foot: ReactNode = null;

  if (stage === 'go') {
    const needsDepart =
      job.status === 'assigned' || job.status === 'preparing' || job.status === 'ready_for_pickup';
    body = (
      <>
        <StageProgress step={STAGE_STEP.go} />
        <Text variant="title">Go to vendor</Text>
        <Text color="secondary">
          {job.status === 'assigned'
            ? 'Head to the vendor to collect this order.'
            : job.status === 'going_to_vendor'
              ? `You are on your way to ${job.vendor.name}. Confirm when you arrive.`
              : `The cafeteria is preparing your order. Head to ${job.vendor.name} and confirm when you arrive.`}
        </Text>
        <StageWayBlock
          icon="storefront"
          heading="Pick up from"
          title={job.vendor.name}
          detail={job.vendor.locationHint}
          mapsLabel={pickupLabel}
          onOpen={(label) => void openMaps(label)}
          mapsDisabled={mapsBusy}
        />
        <StageOrderPreview job={job} showFee />
      </>
    );
    foot = (
      <>
        {actionFailed}
        <Button
          title={
            acting === 'go_to_vendor' || acting === 'arrive'
              ? 'Working…'
              : needsDepart
                ? "I'm on my way"
                : "I've arrived"
          }
          onPress={() => void handleAdvance(needsDepart ? 'go_to_vendor' : 'arrive')}
          disabled={busy}
          loading={acting === 'go_to_vendor' || acting === 'arrive'}
        />
      </>
    );
  } else if (stage === 'collect') {
    const isCod = job.paymentMethod === 'cod';
    const customerTotal = orderTotalCents(job.subtotalCents, job.deliveryFeeCents);
    body = (
      <>
        <StageDots step={STAGE_STEP.collect} label="Delivery stage 2 of 5: collect the food" />
        <View style={styles.titleBlock}>
          <Text variant="title">Collect the food</Text>
          <Text color="secondary">
            Check that the order is ready, then collect it. The food is covered by Send2U —
            never pay with your own money.
          </Text>
        </View>
        <WorkspaceOrderItems job={job} />
        <Card style={styles.card}>
          <View style={styles.moneyRow}>
            <Text color="secondary">Food total (covered by Send2U)</Text>
            <Text variant="price">{formatMYR(foodCents)}</Text>
          </View>
          <View style={styles.moneyRow}>
            <Text color="secondary">Your delivery fee</Text>
            <Text variant="price" style={styles.feeEarn}>
              +{formatMYR(job.deliveryFeeCents)}
            </Text>
          </View>
          {isCod ? (
            <Text color="secondary">
              The customer pays {formatMYR(customerTotal)} in cash on delivery. That cash
              belongs to Send2U — your earning is the delivery fee above.
            </Text>
          ) : (
            <Text color="secondary">
              This order is already paid in Send2U{job.paymentStatus === 'paid' ? '' : ' (payment pending)'}. Just
              collect and deliver — your earning is the delivery fee above.
            </Text>
          )}
        </Card>
      </>
    );
    foot = confirmKind ? (
      confirmPanel
    ) : (
      <>
        {actionFailed}
        <SlideToConfirm
          tone="soft"
          label="Slide to confirm food collected"
          busyLabel="Recording…"
          busy={collecting}
          onConfirm={() => void runCollectChain()}
        />
        {canAbandon ? (
          <Button
            title="Can't complete this delivery"
            variant="tertiary"
            onPress={() => setConfirmKind('abandon')}
            disabled={busy || collecting}
          />
        ) : null}
      </>
    );
  } else if (stage === 'deliver') {
    body = (
      <>
        <StageDots step={STAGE_STEP.deliver} label="Delivery stage 3 of 5: deliver to requester" />
        <View style={styles.titleBlock}>
          <Text variant="title">Deliver to requester</Text>
          <Text color="secondary">Head to the drop-off location.</Text>
        </View>
        <WorkspaceDeliverTo
          job={job}
          mapsLabel={dropoffLabel}
          onOpen={(label) => void openMaps(label)}
          mapsDisabled={mapsBusy}
        />
        <WorkspaceOrderItems job={job} />
        <Card style={styles.card}>
          <View style={styles.moneyRow}>
            <Text color="secondary">Your delivery fee</Text>
            <Text variant="price" style={styles.feeEarn}>
              +{formatMYR(job.deliveryFeeCents)}
            </Text>
          </View>
          {job.paymentMethod === 'cod' ? (
            <Text color="secondary">
              Collect {formatMYR(orderTotalCents(job.subtotalCents, job.deliveryFeeCents))} in
              cash from the customer on handover.
            </Text>
          ) : null}
        </Card>
      </>
    );
    foot = (
      <>
        {actionFailed}
        <SlideToConfirm
          tone="soft"
          label="Slide to start delivery"
          busyLabel="Starting…"
          busy={acting === 'start_delivery'}
          onConfirm={() => void handleAdvance('start_delivery')}
        />
      </>
    );
  } else if (stage === 'confirm') {
    body = (
      <>
        <StageDots step={STAGE_STEP.confirm} label="Delivery stage 4 of 5: confirm delivery" />
        <View style={styles.titleBlock}>
          <Text variant="title">Confirm delivery</Text>
          <Text color="secondary">Hand the food to the requester.</Text>
        </View>
        <WorkspaceDeliverTo
          job={job}
          mapsLabel={dropoffLabel}
          onOpen={(label) => void openMaps(label)}
          mapsDisabled={mapsBusy}
        />
        <WorkspaceOrderItems job={job} />
        <Card style={styles.card}>
          <View style={styles.moneyRow}>
            <Text color="secondary">Your delivery fee</Text>
            <Text variant="price" style={styles.feeEarn}>
              +{formatMYR(job.deliveryFeeCents)}
            </Text>
          </View>
          {job.paymentMethod === 'cod' ? (
            <Text color="secondary">
              Collect {formatMYR(orderTotalCents(job.subtotalCents, job.deliveryFeeCents))} in
              cash from the customer, then confirm the collection.
            </Text>
          ) : null}
        </Card>
      </>
    );
    foot = (
      <>
        {actionFailed}
        <SlideToConfirm
          tone="soft"
          label="Slide to confirm delivery"
          busyLabel="Confirming…"
          busy={acting === 'mark_delivered'}
          onConfirm={() => void handleAdvance('mark_delivered')}
        />
      </>
    );
  } else if (stage === 'done') {
    const codDue =
      job.paymentMethod === 'cod' &&
      job.paymentStatus !== 'collected' &&
      job.paymentStatus !== 'refunded';
    const codDone = job.paymentMethod === 'cod' && job.paymentStatus === 'collected';
    body = (
      <>
        <CompletionResult job={job} staysForCash={codDue} />
        {codDue ? (
          <Card style={styles.card}>
            <Text variant="subtitle">
              Cash due: {formatMYR(job.codExpectedCents ?? orderTotalCents(job.subtotalCents, job.deliveryFeeCents))}
            </Text>
            <Text color="secondary">
              Collect the cash from the customer, then confirm below. Your earning stays
              the delivery fee — the cash belongs to Send2U.
            </Text>
            {actionError ? (
              <ErrorState
                title="Could not record collection"
                message={actionError}
                retryTitle="Dismiss"
                onRetry={() => setActionError(null)}
              />
            ) : null}
            <Button
              title={cashingOut ? 'Recording…' : 'Confirm Cash Collected'}
              onPress={() => void handleCollectCash()}
              disabled={cashingOut}
              loading={cashingOut}
            />
          </Card>
        ) : codDone ? (
          <Card style={styles.card}>
            <Text color="secondary">
              Cash of {formatMYR(job.codCollectedCents ?? orderTotalCents(job.subtotalCents, job.deliveryFeeCents))} collected
              and recorded.
            </Text>
          </Card>
        ) : null}
      </>
    );
    foot = null;
  } else {
    body = (
      <Text variant="caption" color="muted">
        This job is no longer open.
      </Text>
    );
    foot = (
      <Button
        title="Back to portal"
        variant="secondary"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(requester)/helper-portal');
        }}
      />
    );
  }

  return (
    <HelperPortalGuard title="Delivery">
      <GlassHeader
        title="Delivery"
        fallbackHref="/(requester)"
        hideBack={stage === 'go' || stage === 'collect' || stage === 'deliver' || stage === 'confirm'}
        right={
          stage === 'go' || stage === 'collect' || stage === 'deliver' || stage === 'confirm' ? undefined : (
            <HeaderBell />
          )
        }
      />
      <Screen beneathHeader scrollable={false} contentStyle={styles.shell}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
        {foot ? <View style={styles.footer}>{foot}</View> : null}
        {belowFoot}
      </Screen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  // Bordered, explicitly shadow-free card surface for detail/workspace blocks.
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  shell: { paddingBottom: spacing.md },
  scroll: { flex: 1 },
  scrollBody: { gap: spacing.lg, paddingBottom: spacing.md },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressTrack: { flexDirection: 'row', gap: 4, marginTop: spacing.xs },
  progressSeg: { flex: 1, height: 4, borderRadius: 999 },
  progressSegFilled: { backgroundColor: colors.primary },
  progressSegEmpty: { backgroundColor: colors.border },
  navChip: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
  },
  navLabel: { color: colors.primary },
  feeEarn: { fontWeight: '700', color: colors.success },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  dotDone: { backgroundColor: colors.primary },
  dotActive: { width: 18 },
  dotTodo: { backgroundColor: colors.border },
  titleBlock: { gap: spacing.xs },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exceptionLink: {
    alignSelf: 'center',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  confirmPanel: { gap: spacing.sm },
  doneCard: { alignItems: 'center' },
  doneEmblem: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCenter: { textAlign: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemText: { flex: 1, gap: 2 },
  locBlock: { flexDirection: 'row', gap: spacing.md },
  locText: { flex: 1, gap: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  waypoint: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingLeft: 28 },
  waypointText: { flex: 1, gap: 2 },
  waypointTitle: { fontWeight: '600', color: colors.text },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feeAmount: { flex: 1, textAlign: 'right' },
  pressed: { opacity: 0.7 },
});
