import { router } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { MainHeader } from '@/components/MainHeader';
import { RequestCard } from '@/components/RequestCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useMyOrderHistory } from '@/hooks/useMyOrderHistory';
import { useMyOrders } from '@/hooks/useMyOrders';
import type { OrderWithDetails } from '@/types/domain';

function LoadingSkeletons() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading requests">
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.skeletonCard}>
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
        </View>
      ))}
    </View>
  );
}

export default function RequesterOrdersScreen() {
  const active = useMyOrders();
  const history = useMyOrderHistory();

  const openOrder = useCallback((order: OrderWithDetails) => {
    router.push({ pathname: '/(requester)/orders/[id]', params: { id: order.id } });
  }, []);

  const refreshing = active.refreshing || history.refreshing;
  const handleRefresh = useCallback(async () => {
    await Promise.all([active.refresh(), history.refresh()]);
  }, [active, history]);

  return (
    <>
      <Screen
        underTabs
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
        }>
        <MainHeader title="Requests" />
        <View style={styles.section}>
          <Text variant="eyebrow" color="muted" style={styles.sectionHead}>
            ACTIVE REQUESTS
          </Text>
          {active.status === 'loading' ? <LoadingSkeletons /> : null}
          {active.status === 'error' ? (
            <ErrorState
              title="Couldn't load orders"
              message={active.error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={active.retry}
            />
          ) : null}
          {active.status === 'empty' ? (
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
          {active.status === 'ready'
            ? active.orders.map((order, index) => (
                <RequestCard
                  key={order.id}
                  order={order}
                  isLast={index === active.orders.length - 1}
                  onPress={openOrder}
                />
              ))
            : null}
        </View>
        <View style={styles.section}>
          <Text variant="eyebrow" color="muted" style={styles.sectionHead}>
            HISTORY
          </Text>
          {history.status === 'loading' ? <LoadingSkeletons /> : null}
          {history.status === 'error' ? (
            <ErrorState
              title="Couldn't load past requests"
              message={history.error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={history.retry}
            />
          ) : null}
          {history.status === 'empty' ? (
            <EmptyState
              icon="history"
              title="No past requests"
              message="Completed orders will appear here."
            />
          ) : null}
          {history.status === 'ready'
            ? history.orders.map((order, index) => (
                <RequestCard
                  key={order.id}
                  order={order}
                  isLast={index === history.orders.length - 1}
                  onPress={openOrder}
                />
              ))
            : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: spacing.lg },
  sectionHead: { marginBottom: spacing.sm },
  skeletonCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonText: { flex: 1, gap: spacing.sm },
  skeletonRight: { alignItems: 'flex-end', gap: spacing.sm },
});
