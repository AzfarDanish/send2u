import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { RedScreen } from '@/components/RedScreen';
import { VendorMark } from '@/components/VendorMark';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, touchTargets, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useAvailableJobs } from '@/hooks/useAvailableJobs';
import { useHelperAvailability } from '@/hooks/useHelperAvailability';
import { useMyDeliveries } from '@/hooks/useMyDeliveries';
import { distanceMeters } from '@/lib/maps/geo';
import { orderMapGeometry } from '@/lib/maps/orderPoints';
import { formatRouteDistance } from '@/lib/maps/osrm';
import { formatMYR } from '@/lib/money';
import { MAX_ACTIVE_JOBS_PER_HELPER, orderItemsTitle } from '@/lib/orders';
import { acceptOrder } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Straight-line distance from the stall to the drop-off, from the two pins the
 * order already carries.
 *
 * No routed distance and no ETA: a route is only computed for a delivery the
 * helper has already taken (OSRM), and nothing in the backend estimates walking
 * time, so neither number is invented here. A missing pin drops the line rather
 * than printing 0 m.
 */
function distanceLabel(job: OrderWithDetails): string | null {
  const geometry = orderMapGeometry(job);
  if (!geometry.vendor || !geometry.dropoff) return null;
  const formatted = formatRouteDistance(distanceMeters(geometry.vendor, geometry.dropoff));
  return formatted ? `${formatted} to drop-off` : null;
}

/**
 * Scroll clearance the stacked islands need, so the last job row is never
 * hidden behind them. One island's height plus the gap between them, plus a
 * row's worth of breathing room.
 */
const ISLAND_HEIGHT = 60;
function islandClearance(count: number): number {
  if (count <= 0) return 0;
  return count * ISLAND_HEIGHT + (count - 1) * spacing.sm + spacing.xxxl;
}

interface JobRowProps {
  job: OrderWithDetails;
  /** Last row in its list: no divider underneath. */
  isLast?: boolean;
  /** At capacity or offline: the claim would be refused server-side anyway. */
  acceptDisabled: boolean;
  accepting: boolean;
  onOpen: (jobId: string) => void;
  onAccept: (jobId: string) => void;
}

/**
 * Available job row: the stall, what is being ordered, how far it is, and the
 * fee the helper earns, with the claim right there.
 *
 * The row body opens Job Detail (which carries the full request and the same
 * claim); the Accept button claims directly through the identical atomic RPC, so
 * both paths end in one server-side winner. Fixed geometry keeps every row the
 * same height.
 */
function JobRow({ job, isLast = false, acceptDisabled, accepting, onOpen, onAccept }: JobRowProps) {
  const distance = distanceLabel(job);
  const itemTitle = orderItemsTitle(job.items);

  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${job.vendor.name}, ${itemTitle}${distance ? `, ${distance}` : ''}. Opens the request.`}
        onPress={() => onOpen(job.id)}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
        <VendorMark name={job.vendor.name} size={56} shape="square" />
        <View style={styles.rowText}>
          <Text variant="subtitle" numberOfLines={1}>
            {job.vendor.name}
          </Text>
          <Text color="secondary" numberOfLines={1}>
            {itemTitle}
          </Text>
          {distance ? (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {distance}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.rowRight}>
        <Text color="primary" style={styles.earning}>
          {formatMYR(job.deliveryFeeCents)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            accepting
              ? 'Accepting this job'
              : `Accept this job for ${formatMYR(job.deliveryFeeCents)}`
          }
          accessibilityState={{ disabled: acceptDisabled || accepting, busy: accepting }}
          disabled={acceptDisabled || accepting}
          onPress={() => onAccept(job.id)}
          style={({ pressed }) => [
            styles.accept,
            (acceptDisabled || accepting) && styles.acceptDisabled,
            pressed && !acceptDisabled && !accepting && styles.pressed,
          ]}>
          {accepting ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text variant="button" color="onPrimary">
              Accept
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Helper Portal Jobs tab. Verified helpers only (guarded).
 *
 * Answers one question — what can I do right now: whether I am taking work, what
 * is open, and whether a delivery is already running. The acceptance path, the
 * 3-job capacity gate, the availability gate, the broadcast queue and realtime
 * are unchanged; this is the portal's own shell (red header, white sheet) with
 * the claim brought onto the row.
 */
export default function HelperJobsScreen() {
  const { profile, user } = useAuth();
  const { isAvailable, updating, error: availabilityError, setAvailable } = useHelperAvailability();
  const { jobs, status, error, refreshing, retry, refresh } = useAvailableJobs();
  const active = useMyDeliveries();
  const [pillOpen, setPillOpen] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const firstAvailabilityRun = useRef(true);
  useEffect(() => {
    if (firstAvailabilityRun.current) {
      firstAvailabilityRun.current = false;
      return;
    }
    if (isAvailable) void refresh();
  }, [isAvailable, refresh]);

  const handleToggle = useCallback(
    async (next: boolean) => {
      try {
        await setAvailable(next);
      } catch {
        // error already in hook
      }
    },
    [setAvailable],
  );

  const openJob = useCallback((jobId: string) => {
    router.push({ pathname: '/(requester)/helper-portal/jobs/[id]', params: { id: jobId } });
  }, []);

  const activeDeliveries = active.status === 'ready' ? active.deliveries : [];
  const atCapacity = activeDeliveries.length >= MAX_ACTIVE_JOBS_PER_HELPER;

  const handleAccept = useCallback(
    async (jobId: string) => {
      if (acceptingId) return;
      setAcceptingId(jobId);
      setAcceptError(null);
      try {
        await acceptOrder(jobId);
        await Promise.all([active.refresh(), refresh()]);
        // Straight into the job: the next step is going to the stall, and the
        // row can no longer appear in this list now that it is claimed.
        router.push({ pathname: '/(requester)/helper-portal/jobs/[id]', params: { id: jobId } });
      } catch (err) {
        setAcceptError(err instanceof Error ? err.message : 'Could not accept that job.');
        // Another helper may have won this one, or it may have been cancelled:
        // resync rather than leaving a claimable-looking row on screen.
        await refresh();
      } finally {
        setAcceptingId(null);
      }
    },
    [acceptingId, active, refresh],
  );

  const displayName =
    profile?.fullName?.trim() ||
    profile?.displayName?.trim() ||
    user?.email?.split('@')[0] ||
    'Helper';

  return (
    <HelperPortalGuard title="Available Jobs">
      <RedScreen
        title="Available Jobs"
        subtitle="Earn by delivering orders around campus."
        top={
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leave the Helper Portal"
              onPress={() => router.replace('/(requester)')}
              style={({ pressed }) => [styles.leave, pressed && styles.pressed]}>
              <Text variant="status" color="onPrimary">
                Leave
              </Text>
            </Pressable>

            {/* Centred independently of the two controls beside it. */}
            <View style={styles.pillWrap} pointerEvents="box-none">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Availability: ${isAvailable ? 'online' : 'offline'}. Opens availability controls.`}
                accessibilityState={{ expanded: pillOpen }}
                onPress={() => setPillOpen((open) => !open)}
                style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: isAvailable ? colors.success : colors.onPrimary },
                  ]}
                />
                <Text variant="status" color="onPrimary">
                  {isAvailable ? 'Online' : 'Offline'}
                </Text>
                <MaterialIcons
                  name={pillOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={18}
                  color={colors.onPrimary}
                />
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Your helper profile"
              onPress={() => router.push('/(requester)/helper-portal/profile')}
              style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
              {/* The initials avatar is solid brand red, which disappears
                  against this header: the white ring is what makes it read as a
                  photo slot on the red. */}
              <View style={styles.avatarRing}>
                <Avatar name={displayName} path={profile?.avatarPath} size={36} />
              </View>
            </Pressable>
          </View>
        }
        below={
          pillOpen ? (
            <View style={styles.pillPanel}>
              <View style={styles.pillPanelText}>
                <Text variant="secondary" style={styles.pillPanelTitle}>
                  {isAvailable ? 'You are online' : 'You are offline'}
                </Text>
                <Text variant="caption" style={styles.pillPanelBody}>
                  {availabilityError
                    ? availabilityError
                    : updating
                      ? 'Updating…'
                      : isAvailable
                        ? 'Open requests appear below.'
                        : 'Go online to see open requests.'}
                </Text>
              </View>
              <Switch
                value={isAvailable}
                onValueChange={handleToggle}
                disabled={updating}
                trackColor={{ false: 'rgba(255,255,255,0.35)', true: colors.onPrimary }}
                thumbColor={isAvailable ? colors.success : colors.onPrimary}
                accessibilityLabel="Availability for delivery jobs"
              />
            </View>
          ) : null
        }
        footer={
          activeDeliveries.length === 0 ? null : (
            <View style={styles.islandStack}>
              {activeDeliveries.map((delivery) => {
                const pickup = delivery.vendor.locationHint ?? delivery.vendor.name;
                return (
                  <Pressable
                    key={delivery.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Active delivery. Pickup at ${pickup}. Opens the delivery.`}
                    onPress={() => openJob(delivery.id)}
                    style={({ pressed }) => [styles.island, pressed && styles.pressed]}>
                    <View style={styles.islandIcon}>
                      <MaterialIcons name="delivery-dining" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.islandText}>
                      <Text variant="status" color="onPrimary">
                        Active Delivery
                      </Text>
                      <Text
                        variant="caption"
                        color="onPrimary"
                        numberOfLines={1}
                        style={styles.islandSub}>
                        {pickup}
                      </Text>
                    </View>
                    <View style={styles.islandArrow}>
                      <MaterialIcons name="arrow-forward" size={20} color={colors.primary} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )
        }
        footerClearance={islandClearance(activeDeliveries.length)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.onPrimary}
          />
        }>
        {acceptError ? (
          <ErrorState
            title="Could not accept that job"
            message={acceptError}
            retryTitle="Dismiss"
            onRetry={() => setAcceptError(null)}
          />
        ) : null}

        {atCapacity ? (
          <Text variant="caption" color="secondary">
            You have {MAX_ACTIVE_JOBS_PER_HELPER} active jobs — finish one to take another.
          </Text>
        ) : null}

        {!isAvailable ? (
          <View style={styles.offlineNote}>
            <Text variant="secondary" style={styles.offlineTitle}>
              You are offline
            </Text>
            <Text variant="caption" color="secondary">
              Tap the Online pill above to see open requests.
            </Text>
          </View>
        ) : status === 'loading' ? (
          <SkeletonList rows={3} lines={3} thumb={56} round label="Loading open jobs" />
        ) : status === 'error' ? (
          <ErrorState
            title="Couldn't load open jobs"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        ) : status === 'empty' ? (
          <EmptyState icon="work-outline" title="No open requests" message="Pull to refresh." />
        ) : (
          <View>
            {jobs.map((job, index) => (
              <JobRow
                key={job.id}
                job={job}
                isLast={index === jobs.length - 1}
                acceptDisabled={atCapacity || !isAvailable}
                accepting={acceptingId === job.id}
                onOpen={openJob}
                onAccept={(jobId) => void handleAccept(jobId)}
              />
            ))}
          </View>
        )}
      </RedScreen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // The header's `top` slot lays its children out in a row, so a single
    // wrapper must claim the full width or it shrink-wraps and the controls
    // collide at the left edge.
    flex: 1,
  },
  pillWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dot: { width: 8, height: 8, borderRadius: radii.full },
  leave: {
    height: 32,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarButton: { borderRadius: radii.full },
  avatarRing: {
    padding: 2,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
  },
  pillPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  pillPanelText: { flex: 1, gap: spacing.xs },
  pillPanelTitle: { color: colors.onPrimary, fontWeight: '600' },
  pillPanelBody: { color: colors.onPrimary, opacity: 0.9 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTargets.listRow + spacing.xl,
    paddingVertical: spacing.md,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  rowRight: { alignItems: 'flex-end', gap: spacing.sm, maxWidth: 120 },
  earning: { ...typography.price, color: colors.primary },
  accept: {
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  acceptDisabled: { backgroundColor: colors.disabled },
  pressed: { opacity: 0.7 },

  islandStack: { gap: spacing.sm },
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  islandIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onPrimary,
  },
  islandText: { flex: 1, gap: spacing.xs },
  islandSub: { opacity: 0.92 },
  islandArrow: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.onPrimary,
  },
  offlineNote: { gap: spacing.xs, paddingVertical: spacing.sm },
  offlineTitle: { fontWeight: '600', color: colors.text },
});
