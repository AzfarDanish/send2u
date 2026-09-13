import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelativeTime } from '@/lib/orders';
import type { UserRole } from '@/types/domain';

const KIND_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  'order.assigned': 'person-add',
  'order.picked_up': 'shopping-bag',
  'order.out_for_delivery': 'delivery-dining',
  'order.delivered': 'check-circle-outline',
  'order.confirmed': 'verified',
  'order.awaiting_payment': 'payments',
  'order.completed': 'check-circle',
  'order.cancelled': 'cancel',
  'order.disputed': 'report-problem',
};

/**
 * In-app notification center. Same authoritative rows the push fan-out uses,
 * rendered read/unread-distinct. Tapping marks read and opens the order in
 * this role's detail screen. Realtime keeps it live; refresh always works.
 */
export function NotificationCenter({ role }: { role: UserRole }) {
  const { items, unreadCount, status, error, refreshing, retry, refresh, markRead, markAllRead } =
    useNotifications();

  const openOrder = useCallback(
    async (notificationId: string, orderId: string) => {
      try {
        await markRead(notificationId);
      } catch {
        // Navigation is primary; a failed mark (offline) must not block it.
      }
      router.push(
        role === 'helper'
          ? { pathname: '/(helper)/jobs/[id]', params: { id: orderId } }
          : { pathname: '/(requester)/orders/[id]', params: { id: orderId } },
      );
    },
    [markRead, role],
  );

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }>
      <SectionHeader
        eyebrow="Notifications"
        title="Updates for you"
        badge={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        actionTitle={unreadCount > 0 ? 'Mark all read' : undefined}
        onAction={unreadCount > 0 ? () => void markAllRead().catch(() => {}) : undefined}
      />
      {status === 'loading' ? (
        <Card style={styles.stateCard}>
          <LoadingState message="Loading notifications…" />
        </Card>
      ) : null}
      {status === 'error' ? (
        <Card style={styles.stateCard}>
          <ErrorState
            title="Couldn't load notifications"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        </Card>
      ) : null}
      {status === 'empty' ? (
        <EmptyState
          icon="notifications-none"
          title="No notifications yet"
          message="Order updates appear here."
        />
      ) : null}
      {status === 'ready'
        ? items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.body}`}
              onPress={() => void openOrder(item.id, item.orderId)}
              style={({ pressed }) => [pressed && styles.pressed]}>
              <Card style={styles.rowCard}>
                <View style={styles.row}>
                  <View style={styles.iconWrap}>
                    <MaterialIcons
                      name={KIND_ICONS[item.kind] ?? 'notifications'}
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.textBlock}>
                    <View style={styles.titleRow}>
                      <Text variant="secondary" style={styles.title}>
                        {item.title}
                      </Text>
                      {item.readAt ? null : <View style={styles.unreadDot} accessibilityLabel="Unread" />}
                    </View>
                    <Text variant="secondary" color="secondary">
                      {item.body}
                    </Text>
                    <Text variant="caption" color="muted">
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  rowCard: { gap: 0 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontWeight: '600', color: colors.text },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
});
