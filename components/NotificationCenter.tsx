import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SegmentedControl, type SegmentOption } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelativeTime } from '@/lib/orders';
import type { AppNotification } from '@/services/notifications';
import type { UserRole } from '@/types/domain';

const KIND_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  'order.assigned': 'person-add',
  'order.preparing': 'restaurant',
  'order.ready_for_pickup': 'shopping-bag',
  'order.picked_up': 'shopping-bag',
  'order.out_for_delivery': 'delivery-dining',
  'order.delivered': 'check-circle-outline',
  'order.confirmed': 'verified',
  'order.awaiting_payment': 'payments',
  'order.completed': 'check-circle',
  'order.cancelled': 'cancel',
  'order.disputed': 'report-problem',
};

export type NotificationFilter = 'all' | 'unread' | 'orders' | 'system';

const FILTER_OPTIONS: SegmentOption<NotificationFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'orders', label: 'Orders' },
  { value: 'system', label: 'System' },
];

/** Order-lifecycle rows carry the `order.*` kind; anything else is system. */
function isOrderNotification(item: AppNotification): boolean {
  return item.kind.startsWith('order.');
}

function matchesFilter(item: AppNotification, filter: NotificationFilter): boolean {
  switch (filter) {
    case 'unread':
      return !item.readAt;
    case 'orders':
      return isOrderNotification(item);
    case 'system':
      return !isOrderNotification(item);
    case 'all':
    default:
      return true;
  }
}

const EMPTY_COPY: Record<NotificationFilter, { title: string; message: string }> = {
  all: { title: 'No notifications yet', message: 'Order updates appear here.' },
  unread: { title: "You're all caught up", message: 'New updates will appear here.' },
  orders: { title: 'No order updates', message: 'Updates about your requests will appear here.' },
  system: { title: 'No system notifications', message: 'Announcements and account updates will appear here.' },
};

interface NotificationCenterProps {
  role: UserRole;
  /**
   * `custom` renders the compact in-screen nav bar (back + centered title +
   * Mark all read) for routes with `headerShown: false`. `section` keeps the
   * native header plus a SectionHeader — used where the native header stays.
   */
  header?: 'custom' | 'section';
}

/**
 * In-app notification center. Same authoritative rows the push fan-out uses,
 * rendered read/unread-distinct with working All/Unread/Orders/System
 * filters. Tapping marks read and opens the order in this role's detail
 * screen. Realtime keeps it live; refresh always works.
 */
export function NotificationCenter({ role, header = 'section' }: NotificationCenterProps) {
  const { items, unreadCount, status, error, refreshing, retry, refresh, markRead, markAllRead } =
    useNotifications();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [markAllError, setMarkAllError] = useState<string | null>(null);

  const visible = useMemo(() => items.filter((item) => matchesFilter(item, filter)), [items, filter]);
  const emptyCopy = EMPTY_COPY[filter];

  const openNotification = useCallback(
    async (notification: AppNotification) => {
      try {
        await markRead(notification.id);
      } catch {
        // Navigation is primary; a failed mark (offline) must not block it.
      }
      if (!notification.orderId) return;
      router.push(
        role === 'helper'
          ? { pathname: '/(requester)/helper-portal/jobs/[id]', params: { id: notification.orderId } }
          : { pathname: '/(requester)/orders/[id]', params: { id: notification.orderId } },
      );
    },
    [markRead, role],
  );

  const handleMarkAllRead = useCallback(async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    setMarkAllError(null);
    try {
      await markAllRead();
    } catch {
      // The hook rolls state back; surface a quiet inline note, not a screen.
      setMarkAllError('Could not mark all as read. Try again.');
    } finally {
      setMarkingAll(false);
    }
  }, [markAllRead, markingAll, unreadCount]);

  const markAllAction =
    unreadCount > 0 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mark all notifications as read"
        accessibilityState={{ disabled: markingAll }}
        disabled={markingAll}
        hitSlop={8}
        onPress={() => void handleMarkAllRead()}
        style={({ pressed }) => [pressed && styles.pressed]}>
        <Text variant="caption" style={[styles.markAll, markingAll && styles.markAllDisabled]}>
          Mark all read
        </Text>
      </Pressable>
    ) : null;

  // Custom chrome renders the glass header above the scroll view; the
  // native-header variant keeps its section header inside the screen.
  const glass =
    header === 'custom' ? (
      <GlassHeader
        title="Notifications"
        fallbackHref={role === 'helper' ? '/(requester)/helper-portal' : '/(requester)'}
        right={markAllAction}
      />
    ) : null;

  return (
    <>
      {glass}
      <Screen
        beneathHeader={header === 'custom'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }>
        {header === 'custom' ? null : (
          <SectionHeader
            eyebrow="Notifications"
            title="Updates for you"
            badge={unreadCount > 0 ? `${unreadCount} unread` : undefined}
            actionTitle={unreadCount > 0 ? 'Mark all read' : undefined}
            onAction={unreadCount > 0 ? () => void handleMarkAllRead().catch(() => {}) : undefined}
          />
        )}
      {markAllError ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {markAllError}
        </Text>
      ) : null}
      <SegmentedControl
        options={FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Filter notifications"
      />
      {status === 'loading' ? (
        <SkeletonList rows={3} lines={3} thumb={44} round label="Loading notifications" />
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
      {status === 'empty' || (status === 'ready' && visible.length === 0) ? (
        <EmptyState icon="notifications-none" title={emptyCopy.title} message={emptyCopy.message} />
      ) : null}
      {status === 'ready'
        ? visible.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.body}`}
              onPress={() => void openNotification(item)}
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
                    <Text variant="secondary" style={styles.title}>
                      {item.title}
                    </Text>
                    <Text variant="secondary" color="secondary" numberOfLines={3}>
                      {item.body}
                    </Text>
                    <Text variant="caption" color="muted">
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                  {item.readAt ? null : <View style={styles.unreadDot} accessibilityLabel="Unread" />}
                </View>
              </Card>
            </Pressable>
          ))
        : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  markAll: { color: colors.primary, fontWeight: '600' },
  markAllDisabled: { color: colors.disabled },
  stateCard: { minHeight: 200, justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  rowCard: { gap: 0 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: spacing.xs },
  title: { fontWeight: '600', color: colors.text },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
});
