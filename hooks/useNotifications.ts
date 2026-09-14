import { useCallback, useEffect, useRef, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import {
  countUnreadNotifications,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/services/notifications';

export type NotificationsStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseNotificationsResult {
  items: AppNotification[];
  unreadCount: number;
  status: NotificationsStatus;
  error: string | null;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Own notifications, newest first, with a live unread count. New rows arrive
 * through a realtime subscription (RLS-scoped, so only own rows ever arrive);
 * marking read patches the row and count optimistically with server-recount
 * rollback on failure. Screens keep working when realtime is down —
 * refresh/retry always reload from the server.
 */
export function useNotifications(): UseNotificationsResult {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<NotificationsStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setStatus('loading');
    }
    setError(null);
    try {
      const [next, unread] = await Promise.all([listMyNotifications(), countUnreadNotifications()]);
      setItems(next);
      setUnreadCount(unread);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const silentReload = useCallback(async () => {
    try {
      const [next, unread] = await Promise.all([listMyNotifications(), countUnreadNotifications()]);
      setItems(next);
      setUnreadCount(unread);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch {
      // Keep stale data; explicit refresh/retry surfaces errors.
    }
  }, []);

  useRealtimeReload([{ table: 'send2u_notifications', event: '*' }], () => {
    void silentReload();
  });

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  // Latest items for optimistic patches (synced in an effect — refs
  // must not be written during render). Lets mark-read capture the
  // previous row for rollback without churning callback identity.
  const itemsRef = useRef<AppNotification[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const markRead = useCallback(async (id: string) => {
    const target = itemsRef.current.find((item) => item.id === id);
    // Already read (or gone): no-op. This also guards rapid double-taps —
    // the second tap sees the optimistic flag and does nothing.
    if (!target || target.readAt) return;
    const stamped = new Date().toISOString();
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, readAt: stamped } : item)));
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await markNotificationRead(id);
    } catch (err) {
      // Roll back the row; recount from the server so races with
      // realtime arrivals can't corrupt the badge.
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, readAt: target.readAt } : item)),
      );
      try {
        setUnreadCount(await countUnreadNotifications());
      } catch {
        // Keep the optimistic count; realtime/refresh reconciles.
      }
      throw err;
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const unreadIds = new Set(
      itemsRef.current.filter((item) => !item.readAt).map((item) => item.id),
    );
    if (unreadIds.size === 0) return;
    const stamped = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => (unreadIds.has(item.id) ? { ...item, readAt: stamped } : item)),
    );
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      setItems((prev) =>
        prev.map((item) => (unreadIds.has(item.id) ? { ...item, readAt: null } : item)),
      );
      try {
        setUnreadCount(await countUnreadNotifications());
      } catch {
        // Keep the optimistic count; realtime/refresh reconciles.
      }
      throw err;
    }
  }, []);

  return { items, unreadCount, status, error, refreshing, retry, refresh, markRead, markAllRead };
}
