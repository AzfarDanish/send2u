import { router } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useMyDeliveries } from '@/hooks/useMyDeliveries';
import { formatMYR } from '@/lib/money';
import { formatOrderDate } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Helper earnings: delivery fees finalized on completed orders only.
 * Fronted food costs are never counted as earnings — only the fee is.
 */
export default function HelperEarningsScreen() {
  const { deliveries, status, error, refreshing, retry, refresh } = useMyDeliveries();

  const openDelivery = useCallback((delivery: OrderWithDetails) => {
    router.push({ pathname: '/(helper)/jobs/[id]', params: { id: delivery.id } });
  }, []);

  const completed = status === 'ready' ? deliveries.filter((d) => d.status === 'completed') : [];
  const totalCents = completed.reduce((sum, d) => sum + d.deliveryFeeCents, 0);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }>
      <SectionHeader eyebrow="Earnings" title="Your payouts" />
      {status === 'loading' ? (
        <Card style={styles.stateCard}>
          <LoadingState message="Loading earnings…" />
        </Card>
      ) : null}
      {status === 'error' ? (
        <Card style={styles.stateCard}>
          <ErrorState
            title="Couldn't load earnings"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        </Card>
      ) : null}
      {status !== 'loading' && status !== 'error' ? (
        <Card>
          <Text color="secondary">Finalized delivery earnings</Text>
          <Text variant="title" color="primary">
            {formatMYR(totalCents)}
          </Text>
          <Text variant="caption" color="muted">
            {completed.length === 0
              ? 'Finish a delivery and verify its payment to earn your first fee.'
              : `From ${completed.length} completed deliver${completed.length === 1 ? 'y' : 'ies'}. Food you fronted at stalls is not counted here — only delivery fees.`}
          </Text>
        </Card>
      ) : null}
      {status === 'ready' && completed.length === 0 ? (
        <EmptyState
          icon="account-balance-wallet"
          title="No earnings yet"
          message="Completed deliveries and payouts will be summarized here once you finish your first trip."
        />
      ) : null}
      {status === 'ready'
        ? completed.map((trip) => (
            <Card key={trip.id} style={styles.tripCard}>
              <ListRow
                icon="payments"
                title={trip.vendor.name}
                subtitle={`${formatOrderDate(trip.createdAt)} · food ${formatMYR(trip.subtotalCents)} (fronted by you)`}
                onPress={() => openDelivery(trip)}
                right={
                  <View style={styles.right}>
                    <Text variant="secondary" style={styles.fee}>
                      +{formatMYR(trip.deliveryFeeCents)}
                    </Text>
                    <Badge label="Finalized" tone="success" />
                  </View>
                }
              />
            </Card>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  tripCard: { gap: 0 },
  right: { alignItems: 'flex-end', gap: 4 },
  fee: { fontWeight: '700', color: colors.success },
});
