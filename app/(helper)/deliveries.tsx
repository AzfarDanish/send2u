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
import { StageLegend } from '@/components/ui/StageLegend';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useMyDeliveries } from '@/hooks/useMyDeliveries';
import { formatMYR } from '@/lib/money';
import {
  formatOrderDate,
  orderStatusLabel,
  orderStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
} from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

export default function HelperDeliveriesScreen() {
  const { deliveries, status, error, refreshing, retry, refresh } = useMyDeliveries();

  const openDelivery = useCallback((delivery: OrderWithDetails) => {
    router.push({ pathname: '/(helper)/jobs/[id]', params: { id: delivery.id } });
  }, []);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }>
      <SectionHeader
        eyebrow="Deliveries"
        title="Your active jobs"
        badge={status === 'ready' ? `${deliveries.length} active` : undefined}
      />
      {status === 'loading' ? (
        <Card style={styles.stateCard}>
          <LoadingState message="Loading your deliveries…" />
        </Card>
      ) : null}
      {status === 'error' ? (
        <Card style={styles.stateCard}>
          <ErrorState
            title="Couldn't load deliveries"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        </Card>
      ) : null}
      {status === 'empty' ? (
        <EmptyState
          icon="delivery-dining"
          title="No active deliveries"
          message="Accepted jobs show here with pickup and drop-off details. Find one in Jobs."
          actionTitle="Browse jobs"
          onAction={() => router.push('/(helper)')}
        />
      ) : null}
      {status === 'ready'
        ? deliveries.map((delivery) => (
            <Card key={delivery.id} style={styles.deliveryCard}>
              <ListRow
                icon="delivery-dining"
                title={delivery.vendor.name}
                subtitle={`${delivery.location.name} · Accepted ${delivery.acceptedAt ? formatOrderDate(delivery.acceptedAt) : formatOrderDate(delivery.createdAt)}`}
                onPress={() => openDelivery(delivery)}
                right={
                  <View style={styles.right}>
                    <Text variant="secondary" style={styles.subtotal}>
                      {formatMYR(delivery.subtotalCents)}
                    </Text>
                    <Badge
                      label={orderStatusLabel(delivery.status)}
                      tone={orderStatusTone(delivery.status)}
                    />
                    <Badge
                      label={
                        delivery.payment ? paymentStatusLabel(delivery.payment.status) : 'Unpaid'
                      }
                      tone={delivery.payment ? paymentStatusTone(delivery.payment.status) : 'warning'}
                    />
                  </View>
                }
              />
            </Card>
          ))
        : null}
      <Card>
        <StageLegend caption="Each delivery follows these five stages to payout." />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  deliveryCard: { gap: 0 },
  right: { alignItems: 'flex-end', gap: 4 },
  subtotal: { fontWeight: '700', color: colors.primary },
});
