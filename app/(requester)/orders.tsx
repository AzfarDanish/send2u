import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ActiveHistoryToggle, type HistoryTab } from '@/components/ActiveHistoryToggle';
import { GlassHeader } from '@/components/GlassHeader';
import { HeaderBell } from '@/components/HeaderBell';
import { RequestCard } from '@/components/RequestCard';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, radii, spacing } from '@/constants/theme';
import { useMyOrderHistory } from '@/hooks/useMyOrderHistory';
import { useMyOrders } from '@/hooks/useMyOrders';
import type { OrderWithDetails } from '@/types/domain';

function LoadingSkeletons() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading requests">
      {[0, 1, 2].map((row) => (
        <Section key={row} style={styles.skeletonCard}>
          <Skeleton width={56} height={56} radius={radii.md} />
          <View style={styles.skeletonText}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="80%" height={18} />
            <Skeleton width="65%" height={14} />
          </View>
          <View style={styles.skeletonRight}>
            <Skeleton width={72} height={22} radius={radii.full} />
            <Skeleton width={56} height={18} />
          </View>
        </Section>
      ))}
    </View>
  );
}

export default function RequesterOrdersScreen() {
  const [tab, setTab] = useState<HistoryTab>('active');
  const active = useMyOrders();
  // History loads only when visible — except when Active is empty, where the
  // count decides the empty-state copy ("No active orders" vs "No orders yet").
  const history = useMyOrderHistory(tab === 'history' || active.status === 'empty');

  const openOrder = useCallback((order: OrderWithDetails) => {
    router.push({ pathname: '/(requester)/orders/[id]', params: { id: order.id } });
  }, []);

  const refreshing = active.refreshing || (tab === 'history' && history.refreshing);
  const handleRefresh = useCallback(async () => {
    // Refresh the visible list; the hidden one loads (or reloads) on visit.
    await Promise.all([active.refresh(), tab === 'history' ? history.refresh() : Promise.resolve()]);
  }, [active, history, tab]);

  const list = tab === 'active' ? active : history;

  return (
    <>
      <GlassHeader title="Requests" right={<HeaderBell role="requester" />} />
      <Screen
        beneathHeader
        underTabs
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
        }>
        <ActiveHistoryToggle
          tab={tab}
          onChange={setTab}
          historyLabel="Past"
          historyCount={history.orders.length}
        />
        {list.status === 'loading' ? <LoadingSkeletons /> : null}
        {list.status === 'error' ? (
          <Section style={styles.stateCard}>
            <ErrorState
              title={tab === 'active' ? "Couldn't load orders" : "Couldn't load past requests"}
              message={list.error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={list.retry}
            />
          </Section>
        ) : null}
        {list.status === 'empty' && tab === 'active' ? (
          <EmptyState
            icon="receipt-long"
            title={history.orders.length > 0 ? 'No active requests' : 'No orders yet'}
            message={
              history.orders.length > 0
                ? 'Your active requests will appear here after you submit one.'
                : 'New orders appear here.'
            }
            actionTitle="Browse menu"
            onAction={() => router.push('/(requester)')}
          />
        ) : null}
        {list.status === 'empty' && tab === 'history' ? (
          <EmptyState
            icon="history"
            title="No past requests"
            message="Completed and disputed orders will appear here."
          />
        ) : null}
        {list.status === 'ready'
          ? list.orders.map((order) => (
              <RequestCard key={order.id} order={order} onPress={openOrder} />
            ))
          : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonText: { flex: 1, gap: spacing.sm },
  skeletonRight: { alignItems: 'flex-end', gap: spacing.sm },
});
