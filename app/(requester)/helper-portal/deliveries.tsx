import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ActiveHistoryToggle, type HistoryTab } from '@/components/ActiveHistoryToggle';
import { GlassHeader } from '@/components/GlassHeader';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useMyDeliveries } from '@/hooks/useMyDeliveries';
import { useMyDeliveryHistory } from '@/hooks/useMyDeliveryHistory';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, orderStatusLabel, orderStatusTone, orderTotalCents } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * My Deliveries inside Helper Portal. Same active/history queries and
 * realtime behavior as the legacy helper deliveries screen; rows are
 * concise single-badge list items instead of dual-badge cards.
 */
export default function PortalDeliveriesScreen() {
  const [tab, setTab] = useState<HistoryTab>('active');
  const active = useMyDeliveries();
  const history = useMyDeliveryHistory(tab === 'history' || active.status === 'empty');

  const openDelivery = useCallback((delivery: OrderWithDetails) => {
    router.push({ pathname: '/(requester)/helper-portal/jobs/[id]', params: { id: delivery.id } });
  }, []);

  const refreshing = active.refreshing || (tab === 'history' && history.refreshing);
  const handleRefresh = useCallback(async () => {
    await Promise.all([active.refresh(), tab === 'history' ? history.refresh() : Promise.resolve()]);
  }, [active, history, tab]);

  return (
    <HelperPortalGuard title="Deliveries">
      <GlassHeader title="Deliveries" hideBack />
      <Screen
        beneathHeader
        underTabs
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
        }>
        <ActiveHistoryToggle tab={tab} onChange={setTab} historyCount={history.deliveries.length} />
        {tab === 'active' ? (
          <>
            {active.status === 'loading' ? <LoadingState message="Loading your deliveries…" /> : null}
            {active.status === 'error' ? (
              <ErrorState
                title="Couldn't load deliveries"
                message={active.error ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={active.retry}
              />
            ) : null}
            {active.status === 'empty' ? (
              <EmptyState
                icon="delivery-dining"
                title={history.deliveries.length > 0 ? 'No active deliveries' : 'No deliveries yet'}
                message={history.deliveries.length > 0 ? 'Closed jobs live in History.' : 'Accepted jobs appear here.'}
                actionTitle="Browse jobs"
                onAction={() => router.push('/(requester)/helper-portal')}
              />
            ) : null}
            {active.status === 'ready'
              ? active.deliveries.map((delivery) => (
                  <View key={delivery.id} style={styles.row}>
                    <ListRow
                      icon="delivery-dining"
                      title={delivery.vendor.name}
                      subtitle={`${delivery.location.name} · ${formatMYR(orderTotalCents(delivery.subtotalCents, delivery.deliveryFeeCents))} total`}
                      onPress={() => openDelivery(delivery)}
                      right={<Badge label={orderStatusLabel(delivery.status)} tone={orderStatusTone(delivery.status)} />}
                    />
                  </View>
                ))
              : null}
          </>
        ) : (
          <>
            {history.status === 'loading' ? <LoadingState message="Loading your history…" /> : null}
            {history.status === 'error' ? (
              <ErrorState
                title="Couldn't load history"
                message={history.error ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={history.retry}
              />
            ) : null}
            {history.status === 'empty' ? (
              <EmptyState
                icon="history"
                title="No history yet"
                message="Completed, cancelled, and disputed deliveries appear here."
              />
            ) : null}
            {history.status === 'ready'
              ? history.deliveries.map((delivery) => (
                  <View key={delivery.id} style={styles.row}>
                    <ListRow
                      icon="history"
                      title={delivery.vendor.name}
                      subtitle={`${delivery.location.name} · ${formatOrderDate(delivery.createdAt)} · fee ${formatMYR(delivery.deliveryFeeCents)}`}
                      onPress={() => openDelivery(delivery)}
                      right={<Badge label={orderStatusLabel(delivery.status)} tone={orderStatusTone(delivery.status)} />}
                    />
                  </View>
                ))
              : null}
          </>
        )}
        {tab === 'history' && history.status === 'ready' ? (
          <Text variant="caption" color="muted">
            Payouts total your completed delivery fees; food costs you fronted are reimbursed separately by requesters.
          </Text>
        ) : null}
      </Screen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.xs },
});
