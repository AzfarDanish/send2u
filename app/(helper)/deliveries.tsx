import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ActiveHistoryToggle, type HistoryTab } from '@/components/ActiveHistoryToggle';
import { GlassHeader } from '@/components/GlassHeader';
import { HeaderBell } from '@/components/HeaderBell';
import { Badge } from '@/components/ui/Badge';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useMyDeliveries } from '@/hooks/useMyDeliveries';
import { useMyDeliveryHistory } from '@/hooks/useMyDeliveryHistory';
import { formatMYR } from '@/lib/money';
import {
  formatOrderDate,
  orderStatusLabel,
  orderStatusTone,
  orderTotalCents,
  paymentStatusLabel,
  paymentStatusTone,
} from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

export default function HelperDeliveriesScreen() {
  const [tab, setTab] = useState<HistoryTab>('active');
  const active = useMyDeliveries();
  // History loads only when visible — except when Active is empty, where the
  // count decides the empty-state copy. Focus refetches while visible stay.
  const history = useMyDeliveryHistory(tab === 'history' || active.status === 'empty');

  const openDelivery = useCallback((delivery: OrderWithDetails) => {
    router.push({ pathname: '/(helper)/jobs/[id]', params: { id: delivery.id } });
  }, []);

  const refreshing = active.refreshing || (tab === 'history' && history.refreshing);
  const handleRefresh = useCallback(async () => {
    // Refresh the visible list; the hidden one loads (or reloads) on visit.
    await Promise.all([active.refresh(), tab === 'history' ? history.refresh() : Promise.resolve()]);
  }, [active, history, tab]);

  return (
    <>
      <GlassHeader title="My Deliveries" right={<HeaderBell role="helper" />} />
      <Screen
        beneathHeader
        underTabs
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
        }>
        <SectionHeader
          eyebrow="Deliveries"
          title={tab === 'active' ? 'Your active jobs' : 'Delivery history'}
        />
      <ActiveHistoryToggle tab={tab} onChange={setTab} historyCount={history.deliveries.length} />
      {tab === 'active' ? (
        <>
          {active.status === 'loading' ? (
            <Section style={styles.stateCard}>
              <LoadingState message="Loading your deliveries…" />
            </Section>
          ) : null}
          {active.status === 'error' ? (
            <Section style={styles.stateCard}>
              <ErrorState
                title="Couldn't load deliveries"
                message={active.error ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={active.retry}
              />
            </Section>
          ) : null}
          {active.status === 'empty' ? (
            <EmptyState
              icon="delivery-dining"
              title={history.deliveries.length > 0 ? 'No active deliveries' : 'No deliveries yet'}
              message={
                history.deliveries.length > 0
                  ? 'Closed jobs live in History.'
                  : 'Accepted jobs appear here.'
              }
              actionTitle="Browse jobs"
              onAction={() => router.push('/(helper)')}
            />
          ) : null}
          {active.status === 'ready'
            ? active.deliveries.map((delivery) => (
                <Section key={delivery.id} style={styles.deliveryCard}>
                  <ListRow
                    icon="delivery-dining"
                    title={delivery.vendor.name}
                    subtitle={`${delivery.location.name} · Accepted ${delivery.acceptedAt ? formatOrderDate(delivery.acceptedAt) : formatOrderDate(delivery.createdAt)}`}
                    onPress={() => openDelivery(delivery)}
                    right={
                      <View style={styles.right}>
                        <Text variant="secondary" style={styles.subtotal}>
                          {formatMYR(orderTotalCents(delivery.subtotalCents, delivery.deliveryFeeCents))}
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
                </Section>
              ))
            : null}
        </>
      ) : (
        <>
          {history.status === 'loading' ? (
            <Section style={styles.stateCard}>
              <LoadingState message="Loading your history…" />
            </Section>
          ) : null}
          {history.status === 'error' ? (
            <Section style={styles.stateCard}>
              <ErrorState
                title="Couldn't load history"
                message={history.error ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={history.retry}
              />
            </Section>
          ) : null}
          {history.status === 'empty' ? (
            <EmptyState
              icon="history"
              title="No history yet"
              message="Completed and disputed deliveries appear here."
            />
          ) : null}
          {history.status === 'ready'
            ? history.deliveries.map((delivery) => (
                <Section key={delivery.id} style={styles.deliveryCard}>
                  <ListRow
                    icon="history"
                    title={delivery.vendor.name}
                    subtitle={`${delivery.location.name} · ${formatOrderDate(delivery.createdAt)} · fee ${formatMYR(delivery.deliveryFeeCents)}`}
                    onPress={() => openDelivery(delivery)}
                    right={
                      <View style={styles.right}>
                        <Text variant="secondary" style={styles.subtotal}>
                          {formatMYR(orderTotalCents(delivery.subtotalCents, delivery.deliveryFeeCents))}
                        </Text>
                        <Badge
                          label={orderStatusLabel(delivery.status)}
                          tone={orderStatusTone(delivery.status)}
                        />
                      </View>
                    }
                  />
                </Section>
              ))
            : null}
        </>
      )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  deliveryCard: { gap: 0 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  subtotal: { fontWeight: '700', color: colors.primary },
});
