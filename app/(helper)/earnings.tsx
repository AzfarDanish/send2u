import { router } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { GlassHeader } from '@/components/GlassHeader';
import { HeaderBell } from '@/components/HeaderBell';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useMyDeliveryHistory } from '@/hooks/useMyDeliveryHistory';
import { formatMYR } from '@/lib/money';
import { formatOrderDate } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Helper earnings: delivery fees finalized on completed orders only.
 * Reads the HISTORY query (active deliveries never contain completed rows),
 * so earnings stay correct after the active/history split.
 * Fronted food costs are never counted as earnings — only the fee is.
 */
export default function HelperEarningsScreen() {
  const { deliveries, status, error, refreshing, retry, refresh } = useMyDeliveryHistory();

  const openDelivery = useCallback((delivery: OrderWithDetails) => {
    router.push({ pathname: '/(helper)/jobs/[id]', params: { id: delivery.id } });
  }, []);

  const completed = status === 'ready' ? deliveries.filter((d) => d.status === 'completed') : [];
  const totalCents = completed.reduce((sum, d) => sum + d.deliveryFeeCents, 0);

  return (
    <>
      <GlassHeader title="Earnings" right={<HeaderBell role="helper" />} />
      <Screen
        beneathHeader
        underTabs
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }>
        <SectionHeader eyebrow="Earnings" title="Your payouts" />
      {status === 'loading' ? (
        <Section style={styles.stateCard}>
          <LoadingState message="Loading earnings…" />
        </Section>
      ) : null}
      {status === 'error' ? (
        <Section style={styles.stateCard}>
          <ErrorState
            title="Couldn't load earnings"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        </Section>
      ) : null}
      {status !== 'loading' && status !== 'error' ? (
        <Card>
          <Text color="secondary">Finalized delivery earnings</Text>
          <Text variant="title" color="primary">
            {formatMYR(totalCents)}
          </Text>
          <Text variant="caption" color="muted">
            {completed.length === 0
              ? 'Finish a delivery to earn your first fee.'
              : `From ${completed.length} completed deliver${completed.length === 1 ? 'y' : 'ies'}. Delivery fees only.`}
          </Text>
        </Section>
      ) : null}
      {status === 'ready' && completed.length === 0 ? (
        <EmptyState
          icon="account-balance-wallet"
          title="No earnings yet"
          message="Finished deliveries appear here."
        />
      ) : null}
      {status === 'ready'
        ? completed.map((trip) => (
            <Section key={trip.id} style={styles.tripCard}>
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
                  </View>
                }
              />
            </Section>
          ))
        : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  tripCard: { gap: 0 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  fee: { fontWeight: '700', color: colors.success },
});
