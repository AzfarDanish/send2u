import { router, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { useMyOrders } from '@/hooks/useMyOrders';
import { formatOrderDate } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Report-an-issue entry: lists the requester's delivered orders, because
 * the backend only accepts issue reports on delivered requests. Each row
 * opens Request Detail, where the real report form lives. No generic
 * ticket system exists — this page creates none.
 */
export default function ReportIssueScreen() {
  const { orders, status, error, retry } = useMyOrders();
  const reportable = orders.filter((order: OrderWithDetails) => order.status === 'delivered');

  return (
    <>
      <Stack.Screen options={{ title: 'Report an Issue' }} />
      <Screen>
        <SectionHeader eyebrow="Support" title="Report an Issue" />
        <Text color="secondary">
          Issues can be reported on delivered requests. Pick one below to open it.
        </Text>
        {status === 'loading' ? (
          <Card style={styles.stateCard}>
            <LoadingState message="Checking your requests…" />
          </Card>
        ) : null}
        {status === 'error' ? (
          <Card style={styles.stateCard}>
            <ErrorState
              title="Couldn't load requests"
              message={error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={retry}
            />
          </Card>
        ) : null}
        {status === 'ready' || status === 'empty' ? (
          reportable.length === 0 ? (
            <EmptyState
              icon="report-problem"
              title="Nothing to report"
              message="Delivered requests awaiting your confirmation appear here."
              actionTitle="View requests"
              onAction={() => router.push('/(requester)/orders')}
            />
          ) : (
            <Card style={styles.listCard}>
              {reportable.map((order) => (
                <ListRow
                  key={order.id}
                  icon="report-problem"
                  title={order.vendor.name}
                  subtitle={`#${order.id.slice(0, 8)} · Delivered ${formatOrderDate(order.deliveredAt ?? order.updatedAt)}`}
                  onPress={() =>
                    router.push({ pathname: '/(requester)/orders/[id]', params: { id: order.id } })
                  }
                />
              ))}
            </Card>
          )
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  listCard: { gap: 0 },
});
