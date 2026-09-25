import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { HeaderBack } from '@/components/HeaderBack';
import { RedScreen } from '@/components/RedScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, touchTargets } from '@/constants/theme';
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface DaySection {
  key: string;
  heading: string;
  items: AppNotification[];
}

/** Local calendar day id — grouping follows the reader's local midnight. */
function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Bucket for one row's real `created_at`: "Today" / "Yesterday" by local
 * calendar day, then the truthful short date (e.g. "12 Sep"). The date is
 * rendered without a clock time because a heading covers rows stamped at
 * different times, and with the year only once it stops being current.
 */
function sectionOf(iso: string, today: Date): { key: string; heading: string } {
  const date = new Date(iso);
  // Unparseable input is surfaced verbatim rather than silently dated.
  if (Number.isNaN(date.getTime())) return { key: iso, heading: iso };

  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysAgo = Math.round((startOfToday.getTime() - startOfDay.getTime()) / MS_PER_DAY);

  // `<= 0` keeps a clock-skewed future row inside Today instead of inventing a
  // heading for a day that has not happened yet.
  if (daysAgo <= 0) return { key: 'today', heading: 'Today' };
  if (daysAgo === 1) return { key: 'yesterday', heading: 'Yesterday' };

  return {
    key: localDayKey(date),
    heading: date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
    }),
  };
}

/**
 * Consecutive same-day runs from the hook's newest-first rows. Ordering is
 * the server's; this only slices it, so no row is reordered, dropped, or
 * synthesised.
 */
function groupByDay(items: AppNotification[], today: Date): DaySection[] {
  const sections: DaySection[] = [];
  for (const item of items) {
    const { key, heading } = sectionOf(item.createdAt, today);
    const open = sections[sections.length - 1];
    if (open && open.key === key) open.items.push(item);
    else sections.push({ key, heading, items: [item] });
  }
  return sections;
}

function NotificationRow({
  item,
  isLast,
  onPress,
}: {
  item: AppNotification;
  isLast: boolean;
  onPress: () => void;
}) {
  const unread = !item.readAt;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}${unread ? '. Unread' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <MaterialIcons
          name={KIND_ICONS[item.kind] ?? 'notifications'}
          size={22}
          color={colors.primary}
        />
      </View>
      <View style={styles.bodyBlock}>
        <Text variant="secondary" numberOfLines={2} style={unread ? styles.titleUnread : styles.titleRead}>
          {item.title}
        </Text>
        <Text variant="secondary" color={unread ? 'secondary' : 'muted'} numberOfLines={3}>
          {item.body}
        </Text>
      </View>
      {/* Meta sits at the top of the row: the age is what triage reads first. */}
      <View style={styles.metaBlock}>
        <Text variant="caption" color={unread ? 'secondary' : 'muted'}>
          {formatRelativeTime(item.createdAt)}
        </Text>
        {unread ? <View style={styles.unreadDot} /> : null}
      </View>
    </Pressable>
  );
}

interface NotificationCenterProps {
  role: UserRole;
  /**
   * `custom` renders the red-header shell (back chevron + left-aligned title +
   * Mark all as read) for routes with `headerShown: false`. `section` keeps
   * the native header plus a SectionHeader — used where the native header
   * stays.
   */
  header?: 'custom' | 'section';
}

/**
 * In-app notification center. Same authoritative rows the push fan-out uses,
 * rendered read/unread-distinct on the shared red-header shell, grouped by the
 * real day each row was created. Tapping marks read and opens the order in
 * this role's detail screen. Realtime keeps it live; refresh always works.
 */
export function NotificationCenter({ role, header = 'section' }: NotificationCenterProps) {
  const { items, unreadCount, status, error, refreshing, retry, refresh, markRead, markAllRead } =
    useNotifications();
  const [markingAll, setMarkingAll] = useState(false);
  const [markAllError, setMarkAllError] = useState<string | null>(null);

  const sections = useMemo(() => groupByDay(items, new Date()), [items]);

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

  // No unread rows, no action: a dead control would only add noise.
  const markAllAction =
    unreadCount > 0 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mark all notifications as read"
        accessibilityState={{ disabled: markingAll }}
        disabled={markingAll}
        hitSlop={8}
        onPress={() => void handleMarkAllRead()}
        style={({ pressed }) => [styles.markAllButton, pressed && styles.pressed]}>
        <Text
          variant="caption"
          color="onPrimary"
          style={[styles.markAllLabel, markingAll && styles.markAllBusy]}>
          Mark all as read
        </Text>
      </Pressable>
    ) : null;

  const feed = (
    <>
      {markAllError ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {markAllError}
        </Text>
      ) : null}
      {status === 'loading' ? (
        <SkeletonList rows={3} lines={3} thumb={44} round label="Loading notifications" />
      ) : null}
      {status === 'error' ? (
        <ErrorState
          title="Couldn't load notifications"
          message={error ?? 'Check your connection and try again.'}
          retryTitle="Try again"
          onRetry={retry}
        />
      ) : null}
      {status === 'empty' ? (
        <EmptyState
          icon="notifications-none"
          title="No notifications yet"
          message="Order updates will appear here."
        />
      ) : null}
      {status === 'ready'
        ? sections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Text variant="caption" color="secondary" style={styles.sectionHeading}>
                {section.heading}
              </Text>
              {section.items.map((item, index) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  isLast={index === section.items.length - 1}
                  onPress={() => void openNotification(item)}
                />
              ))}
            </View>
          ))
        : null}
    </>
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
  );

  if (header === 'custom') {
    return (
      // 22pt rather than the shell's 28pt default: the back chevron plus
      // "Mark all as read" leaves roughly 180pt of title room at 360pt, where
      // "Notifications" at 28pt ellipsizes. The tab roots keep the large title.
      <RedScreen
        title="Notifications"
        titleSize="title"
        leading={
          <HeaderBack
            fallbackHref={role === 'helper' ? '/(requester)/helper-portal' : '/(requester)'}
            color={colors.onPrimary}
          />
        }
        right={markAllAction}
        refreshControl={refreshControl}>
        {feed}
      </RedScreen>
    );
  }

  return (
    <Screen refreshControl={refreshControl}>
      <SectionHeader
        eyebrow="Notifications"
        title="Updates for you"
        badge={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        actionTitle={unreadCount > 0 ? 'Mark all as read' : undefined}
        onAction={unreadCount > 0 ? () => void handleMarkAllRead() : undefined}
      />
      {feed}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAllButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    // Re-aligns the label's text edge with the header's own padding.
    marginRight: -spacing.sm,
  },
  markAllLabel: { fontWeight: '600' },
  markAllBusy: { opacity: 0.6 },
  pressed: { opacity: 0.7 },
  section: { marginTop: spacing.sm },
  sectionHeading: { fontWeight: '600', marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: touchTargets.listRow,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyBlock: { flex: 1, gap: spacing.xs },
  metaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  titleUnread: { fontWeight: '600', color: colors.text },
  titleRead: { fontWeight: '600', color: colors.secondary },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
});
