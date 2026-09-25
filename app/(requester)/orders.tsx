import { router } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl } from 'react-native';

import { HeaderBell } from '@/components/HeaderBell';
import { RedScreen } from '@/components/RedScreen';
import { RequestCard } from '@/components/RequestCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { colors } from '@/constants/theme';
import { useMyOrders } from '@/hooks/useMyOrders';
import { isTerminalOrderStatus } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * My Orders: the requester's live requests and nothing else. Completed,
 * cancelled, and disputed orders are records — they belong to the history
 * view — so this screen offers no filter and no history section: everything
 * on it is active by construction, and the tab answers one question, "what
 * is happening with my orders right now".
 */
export default function RequesterOrdersScreen() {
  const active = useMyOrders();

  const openOrder = useCallback((order: OrderWithDetails) => {
    router.push({ pathname: '/(requester)/orders/[id]', params: { id: order.id } });
  }, []);

  // `useMyOrders` already scopes its query to active rows; filtering here as
  // well keeps the guarantee on the surface that depends on it, since a row
  // patched by a cancel/confirm can turn terminal between renders.
  const orders = active.orders.filter((order) => !isTerminalOrderStatus(order.status));
  // Ready with nothing left to show means the last active row left while the
  // screen was open; an empty active list is the empty state, not a blank page.
  const nothingActive = active.status === 'empty' || (active.status === 'ready' && orders.length === 0);

  return (
    <RedScreen
      underTabs
      title="My Orders"
      right={
        <HeaderBell role="requester" color={colors.onPrimary} dotColor={colors.surface} />
      }
      refreshControl={
        <RefreshControl
          refreshing={active.refreshing}
          onRefresh={() => void active.refresh()}
          tintColor={colors.primary}
        />
      }>
      {active.status === 'loading' ? (
        <SkeletonList rows={3} lines={3} thumb={56} trailing label="Loading your orders" />
      ) : null}
      {active.status === 'error' ? (
        <ErrorState
          title="Couldn't load orders"
          message={active.error ?? 'Check your connection and try again.'}
          retryTitle="Try again"
          onRetry={active.retry}
        />
      ) : null}
      {nothingActive ? (
        <EmptyState
          icon="receipt-long"
          title="Nothing active right now"
          message="Orders in progress appear here with live progress. Past orders are kept in your Profile."
          actionTitle="Browse menu"
          onAction={() => router.push('/(requester)')}
        />
      ) : null}
      {active.status === 'ready' && orders.length > 0
        ? orders.map((order, index) => (
            <RequestCard
              key={order.id}
              order={order}
              isLast={index === orders.length - 1}
              onPress={openOrder}
            />
          ))
        : null}
    </RedScreen>
  );
}
