import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useMyDeliveries } from '@/hooks/useMyDeliveries';
import { useMyDeliveryHistory } from '@/hooks/useMyDeliveryHistory';
import { formatMYR } from '@/lib/money';
import { formatOrderDate, orderStatusLabel, orderTotalCents } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Minimalist delivery row: thumbnail chip, vendor, route/fee detail,
 * plain status word, chevron, and fee earned. No badges or pills.
 */
function DeliveryRow({
  delivery,
  detail,
  isLast,
  onPress,
}: {
  delivery: OrderWithDetails;
  detail: string;
  isLast?: boolean;
  onPress: (delivery: OrderWithDetails) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${delivery.vendor.name}, ${orderStatusLabel(delivery.status)}`}
      onPress={() => onPress(delivery)}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}>
      <View style={styles.thumb}>
        <MaterialIcons name="delivery-dining" size={26} color={colors.primary} />
      </View>
      <View style={styles.middle}>
        <Text variant="secondary" style={styles.vendor} numberOfLines={1}>
          {delivery.vendor.name}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={2}>
          {detail}
        </Text>
        <Text variant="caption" color="secondary" numberOfLines={1}>
          {orderStatusLabel(delivery.status)}
        </Text>
      </View>
      <View style={styles.right}>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
        <Text variant="price" style={styles.fee}>
          +{formatMYR(delivery.deliveryFeeCents)}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * My Deliveries inside Helper Portal. Active deliveries first, history
 * below — no tabs. Same queries and realtime behavior; minimalist rows.
 */
export default function PortalDeliveriesScreen() {
  const active = useMyDeliveries();
  const history = useMyDeliveryHistory();

  const openDelivery = useCallback((delivery: OrderWithDetails) => {
    router.push({ pathname: '/(requester)/helper-portal/jobs/[id]', params: { id: delivery.id } });
  }, []);

  const refreshing = active.refreshing || history.refreshing;
  const handleRefresh = useCallback(async () => {
    await Promise.all([active.refresh(), history.refresh()]);
  }, [active, history]);

  // Settled earnings: delivery fees on completed + settled orders only.
  const settledEarnings =
    history.status === 'ready'
      ? history.deliveries
          .filter((d) => d.status === 'completed' && d.settlementStatus === 'settled')
          .reduce((sum, d) => sum + d.deliveryFeeCents, 0)
      : 0;

  return (
    <HelperPortalGuard title="Deliveries">
      <GlassHeader title="Deliveries" hideBack />
      <Screen
        beneathHeader
        underTabs
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.primary} />
        }>
        <View style={styles.section}>
          <Text variant="eyebrow" color="muted" style={styles.sectionHead}>
            ACTIVE DELIVERIES
          </Text>
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
              message={history.deliveries.length > 0 ? 'Closed jobs live in History below.' : 'Accepted jobs appear here.'}
              actionTitle="Browse jobs"
              onAction={() => router.push('/(requester)/helper-portal')}
            />
          ) : null}
          {active.status === 'ready'
            ? active.deliveries.map((delivery, index) => (
                <DeliveryRow
                  key={delivery.id}
                  delivery={delivery}
                  detail={
                    delivery.paymentMethod === 'cod'
                      ? `${delivery.location.name} · collect ${formatMYR(orderTotalCents(delivery.subtotalCents, delivery.deliveryFeeCents))} cash`
                      : `${delivery.location.name} · ${delivery.paymentStatus === 'paid' ? 'paid via Send2U' : 'online payment pending'}`
                  }
                  isLast={index === active.deliveries.length - 1}
                  onPress={openDelivery}
                />
              ))
            : null}
        </View>
        <View style={styles.section}>
          <Text variant="eyebrow" color="muted" style={styles.sectionHead}>
            HISTORY
          </Text>
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
            ? history.deliveries.map((delivery, index) => (
                <DeliveryRow
                  key={delivery.id}
                  delivery={delivery}
                  detail={`${delivery.location.name} · ${formatOrderDate(delivery.createdAt)}`}
                  isLast={index === history.deliveries.length - 1}
                  onPress={openDelivery}
                />
              ))
            : null}
          {history.status === 'ready' ? (
            <Text variant="caption" color="muted">
              Settled earnings so far: {formatMYR(settledEarnings)}. Only delivery fees
              count as earnings — food is covered by Send2U, and COD cash you collect
              belongs to Send2U.
            </Text>
          ) : null}
        </View>
      </Screen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: spacing.lg },
  sectionHead: { marginBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  middle: { flex: 1, minWidth: 0, gap: 2 },
  vendor: { fontWeight: '600', color: colors.text },
  right: { alignItems: 'flex-end', gap: spacing.xs, flexShrink: 0 },
  fee: { fontWeight: '700', color: colors.success, fontVariant: ['tabular-nums'] as const },
});
