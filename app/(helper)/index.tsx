import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Switch, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
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
import { formatMYR } from '@/lib/money';
import { formatOrderDate } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

const HOW_HELPING_WORKS = [
  { icon: 'check-circle-outline', title: 'Accept a request', subtitle: 'Pick jobs that fit between your classes.' },
  { icon: 'storefront', title: 'Pick up from the vendor', subtitle: 'Show the order and collect the sealed meal.' },
  { icon: 'handshake', title: 'Hand over & confirm', subtitle: 'Meet the requester and confirm delivery.' },
] as const;

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
  // Local UI state only — real availability sync arrives with dispatch.
  const [available, setAvailable] = useState(false);
  const { jobs, status, error, refreshing, retry, refresh } = useAvailableJobs();

  // Going available must show the current queue, not the (possibly stale)
  // snapshot from when the screen first mounted while offline.
  useEffect(() => {
    if (available) void refresh();
  }, [available, refresh]);

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
        badge={available && status === 'ready' ? `${jobs.length} open` : undefined}
      />
      <Card>
        <View style={styles.availability}>
          <View style={styles.availabilityText}>
            <Text variant="subtitle">{available ? "You're available" : "You're offline"}</Text>
            <Text color="secondary">
              {available
                ? 'Open requests near you will appear below.'
                : 'Go available to see open requests around campus.'}
            </Text>
          </View>
          <Switch
            value={available}
            onValueChange={setAvailable}
            trackColor={{ false: colors.disabledBackground, true: colors.primarySoft }}
            thumbColor={available ? colors.primary : colors.muted}
            accessibilityLabel="Availability for delivery jobs"
          />
        </View>
      </Card>

      {!available ? (
        <EmptyState
          icon="schedule"
          title="You're offline"
          message="Flip availability on when you're free to deliver between classes."
        />
      ) : status === 'loading' ? (
        <Card style={styles.stateCard}>
          <LoadingState message="Finding open requests…" />
        </Card>
      ) : status === 'error' ? (
        <Card style={styles.stateCard}>
          <ErrorState
            title="Couldn't load jobs"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        </Card>
      ) : status === 'empty' ? (
        <EmptyState
          icon="work-outline"
          title="No open requests"
          message="New delivery requests near you will appear here. Pull down to check again."
        />
      ) : (
        jobs.map((job) => (
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
                  <Badge label="Pending" tone="info" />
                </View>
              }
            />
          </Card>
        ))
      )}

      <SectionHeader title="How helping works" />
      <Card>
        {HOW_HELPING_WORKS.map((step) => (
          <ListRow key={step.title} icon={step.icon} title={step.title} subtitle={step.subtitle} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  availability: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  availabilityText: { flex: 1, gap: spacing.xs },
  stateCard: { minHeight: 200, justifyContent: 'center' },
  jobCard: { gap: 0 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  subtotal: { fontWeight: '700', color: colors.primary },
});
