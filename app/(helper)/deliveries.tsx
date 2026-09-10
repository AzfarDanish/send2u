import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ActiveHistoryToggle, type HistoryTab } from '@/components/ActiveHistoryToggle';
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
import { colors, spacing } from '@/constants/theme';
import { useMyDeliveries } from '@/hooks/useMyDeliveries';
import { useMyDeliveryHistory } from '@/hooks/useMyDeliveryHistory';
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
  const [tab, setTab] = useState<HistoryTab>('active');
  const active = useMyDeliveries();
  const history = useMyDeliveryHistory();

  const openDelivery = useCallback((delivery: OrderWithDetails) => {
    router.push({ pathname: '/(helper)/jobs/[id]', params: { id: delivery.id } });
  }, []);

  const refreshing = active.refreshing || history.refreshing;
  const handleRefresh = useCallback(async () => {
    await Promise.all([active.refresh(), history.refresh()]);
  }, [active, history]);

  const badge =
    tab === 'active'
      ? active.status === 'ready'
        ? `${active.deliveries.length} active`
        : undefined
      : history.status === 'ready'
        ? `${history.deliveries.length} in history`
        : undefined;

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
      }>
      <SectionHeader
        eyebrow="Deliveries"
        title={tab === 'active' ? 'Your active jobs' : 'Delivery history'}
        badge={badge}
      />
      <ActiveHistoryToggle tab={tab} onChange={setTab} historyCount={history.deliveries.length} />
      {tab === 'active' ? (
        <>
          {active.status === 'loading' ? (
            <Card style={styles.stateCard}>
              <LoadingState message="Loading your deliveries…" />
            </Card>
          ) : null}
          {active.status === 'error' ? (
            <Card style={styles.stateCard}>
              <ErrorState
                title="Couldn't load deliveries"
                message={active.error ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={active.retry}
              />
            </Card>
          ) : null}
          {active.status === 'empty' ? (
            <EmptyState
              icon="delivery-dining"
              title={history.deliveries.length > 0 ? 'No active deliveries' : 'No deliveries yet'}
              message={
                history.deliveries.length > 0
                  ? 'Nothing needs your attention right now. Closed jobs live in History.'
                  : 'Accepted jobs show here with pickup and drop-off details. Find one in Jobs.'
              }
              actionTitle="Browse jobs"
              onAction={() => router.push('/(helper)')}
            />
          ) : null}
          {active.status === 'ready'
            ? active.deliveries.map((delivery) => (
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
        </>
      ) : (
        <>
          {history.status === 'loading' ? (
            <Card style={styles.stateCard}>
              <LoadingState message="Loading your history…" />
            </Card>
          ) : null}
          {history.status === 'error' ? (
            <Card style={styles.stateCard}>
              <ErrorState
                title="Couldn't load history"
                message={history.error ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={history.retry}
              />
            </Card>
          ) : null}
          {history.status === 'empty' ? (
            <EmptyState
              icon="history"
              title="No history yet"
              message="Completed, cancelled, and settled deliveries will appear here as read-only records."
            />
          ) : null}
          {history.status === 'ready'
            ? history.deliveries.map((delivery) => (
                <Card key={delivery.id} style={styles.deliveryCard}>
                  <ListRow
                    icon="history"
                    title={delivery.vendor.name}
                    subtitle={`${delivery.location.name} · ${formatOrderDate(delivery.createdAt)} · fee ${formatMYR(delivery.deliveryFeeCents)}`}
                    onPress={() => openDelivery(delivery)}
                    right={
                      <View style={styles.right}>
                        <Badge
                          label={orderStatusLabel(delivery.status)}
                          tone={orderStatusTone(delivery.status)}
                        />
                      </View>
                    }
                  />
                </Card>
              ))
            : null}
        </>
      )}
      <Card>
        <StageLegend caption="Each delivery follows these five stages to payout." />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  deliveryCard: { gap: 0 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  subtotal: { fontWeight: '700', color: colors.primary },
});
