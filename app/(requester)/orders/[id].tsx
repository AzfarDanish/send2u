import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, orderStatusLabel, orderStatusTone } from '@/lib/orders';
import { getOrderDetail } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

/** Requester order detail: snapshots, subtotal, location, honest status. */
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let mounted = true;
    setStatus('loading');
    setOrder(null);
    (async () => {
      try {
        const found = typeof id === 'string' ? await getOrderDetail(id) : null;
        if (mounted) {
          setOrder(found);
          setStatus(found ? 'ready' : 'missing');
        }
      } catch {
        if (mounted) setStatus('missing');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (status === 'loading' || !order) {
    return (
      <>
        <Stack.Screen options={{ title: 'Order details' }} />
        <Screen>
          {status === 'loading' ? (
            <LoadingState message="Loading order…" />
          ) : (
            <ErrorState
              title="Order not found"
              message="This order isn't available to you. It may belong to another requester."
              retryTitle="Back to orders"
              onRetry={() => router.back()}
            />
          )}
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: order.vendor.name }} />
      <Screen>
        <View style={styles.heading}>
          <Text variant="title">{order.vendor.name}</Text>
          <Badge label={orderStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
        </View>
        <Text variant="caption" color="secondary">
          Placed {formatOrderDate(order.createdAt)}
        </Text>

        <Card>
          <View style={styles.row}>
            <MaterialIcons name="place" size={20} color={colors.primary} />
            <Text variant="secondary" style={styles.rowText}>
              {order.location.name}
            </Text>
          </View>
          <Text variant="caption" color="muted">
            {order.vendor.locationHint ?? 'Campus vendor'}
          </Text>
        </Card>

        <Card style={styles.itemsCard}>
          {order.items.map((item) => (
            <View key={item.id} style={styles.line}>
              <View style={styles.lineText}>
                <Text variant="secondary" style={styles.lineName}>
                  {item.quantity} × {item.itemName}
                </Text>
                <Text variant="caption" color="secondary">
                  {formatMYR(item.unitPriceCents)} each
                </Text>
              </View>
              <Text variant="secondary" style={styles.lineTotal}>
                {formatMYR(item.lineTotalCents)}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <View style={styles.subtotalRow}>
            <Text variant="subtitle">Subtotal</Text>
            <Text variant="title" color="primary">
              {formatMYR(order.subtotalCents)}
            </Text>
          </View>
          <Text variant="caption" color="muted">
            Snapshot of what you requested — menu prices may change later, but this stays.
          </Text>
        </Card>

        {order.status === 'pending' ? (
          <Card>
            <Text variant="caption" color="muted">
              Still pending — no helper has been assigned yet. Helper assignment arrives in a later
              task.
            </Text>
          </Card>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, fontWeight: '600', color: colors.text },
  itemsCard: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  lineText: { flex: 1, gap: 2 },
  lineName: { fontWeight: '600', color: colors.text },
  lineTotal: { fontWeight: '700', color: colors.primary },
  subtotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
