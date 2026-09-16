import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, Switch, View } from 'react-native';

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
import { useAvailableJobs } from '@/hooks/useAvailableJobs';
import { useHelperAvailability } from '@/hooks/useHelperAvailability';
import { formatMYR } from '@/lib/money';
import { formatOrderDate } from '@/lib/orders';
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

export default function HelperJobsScreen() {
  const { isAvailable, updating, error: availabilityError, setAvailable } = useHelperAvailability();
  const { jobs, status, error, refreshing, retry, refresh } = useAvailableJobs();
  const [actionError, setActionError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Keep the queue fresh when availability flips. Skipped on mount: the
  // hook's own focus effect already performs the initial load, and firing
  // both would fetch the queue twice.
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
      setActionError(null);
      try {
        await acceptOrder(jobId);
        // The claim is atomic first-wins; the winner goes straight to the job.
        router.push({ pathname: '/(helper)/jobs/[id]', params: { id: jobId } });
      } catch (err) {
        // Usually a lost race: someone just took it. Refresh so the taken
        // job disappears without manual action.
        setActionError(err instanceof Error ? err.message : 'Could not accept the job.');
        await refresh();
      } finally {
        setAcceptingId(null);
      }
    },
    [acceptingId, refresh],
  );

  const openJob = useCallback((job: OrderWithDetails) => {
    router.push({ pathname: '/(helper)/jobs/[id]', params: { id: job.id } });
  }, []);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }>
      <SectionHeader
        eyebrow="Helper hub"
        title="Delivery jobs"
        badge={isAvailable && status === 'ready' ? `${jobs.length} open` : undefined}
      />
      <Card>
        <View style={styles.availability}>
          <View style={styles.availabilityText}>
            <Text variant="subtitle">{isAvailable ? "You're available" : "You're offline"}</Text>
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
      </Card>

      {!isAvailable ? (
        <EmptyState
          icon="schedule"
          title="You're offline"
          message="Go available to see open requests."
        />
      ) : status === 'loading' ? (
        <Card style={styles.stateCard}>
          <LoadingState message="Finding open jobs…" />
        </Card>
      ) : status === 'error' ? (
        <Card style={styles.stateCard}>
          <ErrorState
            title="Couldn't load open jobs"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        </Card>
      ) : status === 'empty' ? (
        <EmptyState
          icon="work-outline"
          title="No open requests"
          message="Pull to refresh."
        />
      ) : (
        <>
          {actionError ? (
            <ErrorState title="Could not accept" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
          ) : null}
          {jobs.map((job) => {
            const isAccepting = acceptingId === job.id;
            return (
              <Card key={job.id} style={styles.jobCard}>
                <ListRow
                  icon="delivery-dining"
                  title={job.vendor.name}
                  subtitle={`${jobItemSummary(job)} · ${job.location.name} · ${formatOrderDate(job.createdAt)}`}
                  onPress={() => openJob(job)}
                  right={
                    <View style={styles.right}>
                      <Text variant="secondary" style={styles.subtotal}>
                        {formatMYR(job.subtotalCents)}
                      </Text>
                    </View>
                  }
                />
                <Button
                  title={isAccepting ? 'Accepting…' : 'Accept job'}
                  onPress={() => void handleAccept(job.id)}
                  disabled={isAccepting}
                  loading={isAccepting}
                />
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  availability: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  availabilityText: { flex: 1, gap: spacing.xs },
  stateCard: { minHeight: 200, justifyContent: 'center' },
  jobCard: { gap: spacing.sm },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  subtotal: { fontWeight: '700', color: colors.primary },
});
