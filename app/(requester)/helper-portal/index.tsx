import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Switch, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useAvailableJobs } from '@/hooks/useAvailableJobs';
import { useHelperAvailability } from '@/hooks/useHelperAvailability';
import { useMyDeliveries } from '@/hooks/useMyDeliveries';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, orderStatusLabel } from '@/lib/orders';
import { acceptOrder } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

function jobItemSummary(job: OrderWithDetails): string {
  const count = job.items.reduce((sum, item) => sum + item.quantity, 0);
  const first = job.items[0];
  if (!first) return 'No items';
  const rest = count - first.quantity;
  return rest > 0
    ? `${first.quantity} × ${first.itemName} + ${rest} more`
    : `${first.quantity} × ${first.itemName}`;
}

/**
 * Helper Portal home / Job Queue. Verified helpers only (guarded).
 * Reuses the broadcast queue (pending + unassigned, oldest first),
 * atomic first-wins acceptance, realtime + focus refresh, and the
 * availability gate — presentation only is new: the helper's delivery
 * fee leads each job (not the food subtotal), the row is plain
 * navigation while Accept is the sole filled action, and accept
 * failures anchor to the job that failed.
 */
export default function HelperPortalScreen() {
  const { isAvailable, updating, error: availabilityError, setAvailable } = useHelperAvailability();
  const { jobs, status, error, refreshing, retry, refresh } = useAvailableJobs();
  const active = useMyDeliveries();
  const [failedJob, setFailedJob] = useState<{ id: string; message: string } | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

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

  const handleAccept = useCallback(
    async (jobId: string) => {
      if (acceptingId) return;
      setAcceptingId(jobId);
      setFailedJob(null);
      try {
        await acceptOrder(jobId);
        router.push({ pathname: '/(requester)/helper-portal/jobs/[id]', params: { id: jobId } });
      } catch (err) {
        setFailedJob({
          id: jobId,
          message: err instanceof Error ? err.message : 'Could not accept the job.',
        });
        await refresh();
      } finally {
        setAcceptingId(null);
      }
    },
    [acceptingId, refresh],
  );

  const openJob = useCallback((jobId: string) => {
    router.push({ pathname: '/(requester)/helper-portal/jobs/[id]', params: { id: jobId } });
  }, []);

  const activeDeliveries = active.status === 'ready' ? active.deliveries : [];

  return (
    <HelperPortalGuard title="Helper Portal">
      <GlassHeader title="Helper Portal" fallbackHref="/(requester)/profile" />
      <Screen
        beneathHeader
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
            <Text variant="subtitle">Continue working</Text>
            {activeDeliveries.slice(0, 1).map((delivery) => (
              <View key={delivery.id} style={styles.rowWrap}>
                <ListRow
                  icon="delivery-dining"
                  title={delivery.vendor.name}
                  subtitle={`${orderStatusLabel(delivery.status)} · ${delivery.location.name} · fee ${formatMYR(delivery.deliveryFeeCents)}`}
                  onPress={() => openJob(delivery.id)}
                />
              </View>
            ))}
            {activeDeliveries.length > 1 ? (
              <Button
                title={`View all ${activeDeliveries.length} active`}
                variant="secondary"
                onPress={() => router.push('/(requester)/helper-portal/deliveries')}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text variant="subtitle">
            Available jobs{isAvailable && status === 'ready' ? ` · ${jobs.length}` : ''}
          </Text>
          {!isAvailable ? (
            <View style={styles.offlineNote}>
              <Text variant="secondary" style={styles.offlineTitle}>
                You are offline
              </Text>
              <Text variant="caption" color="secondary">
                Go available above to see open requests. Your portal stays accessible.
              </Text>
            </View>
          ) : status === 'loading' ? (
            <LoadingState message="Finding open jobs…" />
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
              {jobs.map((job) => {
                const isAccepting = acceptingId === job.id;
                return (
                  <View key={job.id} style={styles.jobRow}>
                    <ListRow
                      icon="delivery-dining"
                      title={job.vendor.name}
                      subtitle={`${jobItemSummary(job)} · ${job.location.name} · ${formatOrderDate(job.createdAt)}`}
                      onPress={() => openJob(job.id)}
                    />
                    <View style={styles.earningRow}>
                      <Text variant="secondary" style={styles.fee}>
                        +{formatMYR(job.deliveryFeeCents)} fee
                      </Text>
                      <Text variant="caption" color="muted">
                        Food {formatMYR(job.subtotalCents)} · you front this
                      </Text>
                    </View>
                    <Button
                      title={isAccepting ? 'Accepting…' : 'Accept'}
                      onPress={() => void handleAccept(job.id)}
                      disabled={isAccepting}
                      loading={isAccepting}
                    />
                    {failedJob?.id === job.id ? (
                      <ErrorState
                        title="Could not accept"
                        message={failedJob.message}
                        retryTitle="Dismiss"
                        onRetry={() => setFailedJob(null)}
                      />
                    ) : null}
                  </View>
                );
              })}
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.rowWrap}>
            <ListRow
              icon="history"
              title="My Deliveries"
              onPress={() => router.push('/(requester)/helper-portal/deliveries')}
            />
          </View>
          <View style={styles.rowWrap}>
            <ListRow
              icon="qr-code"
              title="Payment QR"
              onPress={() => router.push('/(requester)/helper-portal/payment-qr')}
            />
          </View>
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  availabilityText: { flex: 1, gap: spacing.xs },
  availabilityTitle: { fontWeight: '600', color: colors.text },
  section: { gap: spacing.sm, paddingTop: spacing.md },
  rowWrap: { borderBottomWidth: 1, borderBottomColor: colors.border },
  jobRow: { gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  offlineNote: { gap: spacing.xs, paddingVertical: spacing.md, alignItems: 'center' },
  offlineTitle: { fontWeight: '600', color: colors.text },
  earningRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  fee: { fontWeight: '700', color: colors.success },
});
