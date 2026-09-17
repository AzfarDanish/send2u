import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, RefreshControl, StyleSheet, Switch, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { HeaderBell } from '@/components/HeaderBell';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { VendorMark } from '@/components/VendorMark';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAvailableJobs } from '@/hooks/useAvailableJobs';
import { useHelperAvailability } from '@/hooks/useHelperAvailability';
import { useMyDeliveries } from '@/hooks/useMyDeliveries';
import { helperStatusLabel, MAX_ACTIVE_JOBS_PER_HELPER } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

function itemCountLabel(job: OrderWithDetails): string {
  const count = job.items.reduce((sum, item) => sum + item.quantity, 0);
  return count === 1 ? '1 item' : `${count} items`;
}

function availabilityLabel(job: OrderWithDetails): string {
  const pickup = job.vendor.locationHint ?? job.vendor.name;
  return `${pickup} → ${job.location.name}`;
}

interface JobRowProps {
  job: OrderWithDetails;
  status?: string;
  /** Last row in its list: no divider underneath. */
  isLast?: boolean;
  onPress: (jobId: string) => void;
}

/**
 * Visual-first job row: vendor mark, name, item count, route, and an
 * optional status word with a navigation chevron. Fixed geometry — every
 * row is the same height, separated by hairlines. Rows only navigate;
 * claiming happens on Job Detail. No amounts, ETAs, estimates, badges,
 * pills, or cards: plain type hierarchy only.
 */
function JobRow({ job, status, isLast = false, onPress }: JobRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${job.vendor.name}, ${itemCountLabel(job)}`}
      onPress={() => onPress(job.id)}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}>
      <VendorMark name={job.vendor.name} size={56} />
      <View style={styles.rowText}>
        <Text variant="subtitle" numberOfLines={1}>
          {job.vendor.name}
        </Text>
        <Text color="secondary" numberOfLines={1}>
          {itemCountLabel(job)}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={1}>
          {availabilityLabel(job)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {status ? (
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {status}
          </Text>
        ) : null}
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
      </View>
    </Pressable>
  );
}

function JobRowSkeleton() {
  return (
    <View style={styles.row} accessibilityRole="progressbar" accessibilityLabel="Loading jobs">
      <Skeleton width={56} height={56} radius={radii.full} />
      <View style={styles.rowText}>
        <Skeleton width="60%" height={18} />
        <Skeleton width="40%" height={16} />
        <Skeleton width="75%" height={14} />
      </View>
    </View>
  );
}

/**
 * Helper Portal Jobs tab. Verified helpers only (guarded). Answers one
 * question — what can I do right now: active workload with its 3-job
 * capacity, then genuinely available opportunities. Rows identify and
 * navigate; Job Detail decides and claims. Broadcast queue, atomic
 * first-wins acceptance, realtime, and the availability gate are
 * unchanged — only this presentation is new.
 */
export default function HelperJobsScreen() {
  const { isAvailable, updating, error: availabilityError, setAvailable } = useHelperAvailability();
  const { jobs, status, error, refreshing, retry, refresh } = useAvailableJobs();
  const active = useMyDeliveries();

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

  return (
    <HelperPortalGuard title="Jobs">
      <GlassHeader
        title="Jobs"
        fallbackHref="/(requester)"
        right={<HeaderBell />}
      />
      <Screen
        beneathHeader
        underTabs
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }>
        <View style={styles.availabilityRow}>
          <View style={styles.availabilityText}>
            <Text variant="secondary" style={styles.availabilityTitle}>
              {isAvailable ? 'Available for jobs' : 'Offline'}
            </Text>
            {availabilityError ? (
              <Text variant="caption" color="secondary">
                {availabilityError}
              </Text>
            ) : null}
          </View>
          <Switch
            value={isAvailable}
            onValueChange={handleToggle}
            disabled={updating}
            trackColor={{ false: colors.disabledBackground, true: colors.primarySoft }}
            thumbColor={isAvailable ? colors.primary : colors.muted}
            accessibilityLabel="Availability for delivery jobs"
          />
        </View>

        {activeDeliveries.length > 0 ? (
          <View style={styles.section}>
            <Text variant="eyebrow" color="muted" style={styles.sectionHead}>
              {`Active jobs · ${activeDeliveries.length}/${MAX_ACTIVE_JOBS_PER_HELPER}`.toUpperCase()}
            </Text>
            {activeDeliveries.map((delivery, index) => (
              <JobRow
                key={delivery.id}
                job={delivery}
                status={helperStatusLabel(delivery.status)}
                isLast={index === activeDeliveries.length - 1}
                onPress={openJob}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="eyebrow" color="muted" style={styles.sectionHead}>
            AVAILABLE JOBS
          </Text>
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
                Go available above to see open requests.
              </Text>
            </View>
          ) : status === 'loading' ? (
            <>
              <JobRowSkeleton />
              <JobRowSkeleton />
              <JobRowSkeleton />
            </>
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
            <>
              {jobs.map((job, index) => (
                <JobRow key={job.id} job={job} isLast={index === jobs.length - 1} onPress={openJob} />
              ))}
            </>
          )}
        </View>
      </Screen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  availabilityText: { flex: 1, gap: spacing.xs },
  availabilityTitle: { fontWeight: '600', color: colors.text },
  section: { paddingTop: spacing.xl },
  sectionHead: { marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 76,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, gap: 2, minWidth: 0 },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 2, maxWidth: 110 },
  offlineNote: { gap: spacing.xs, paddingVertical: spacing.md, alignItems: 'center' },
  offlineTitle: { fontWeight: '600', color: colors.text },
});
