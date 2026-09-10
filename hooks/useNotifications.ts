import { useCallback, useEffect, useState } from 'react';

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
 * marking read refetches so the count stays truthful. Screens keep working
 * when realtime is down — refresh/retry always reload from the server.
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

  const markRead = useCallback(
    async (id: string) => {
      await markNotificationRead(id);
      await load(true);
    },
    [load],
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    await load(true);
  }, [load]);

  return { items, unreadCount, status, error, refreshing, retry, refresh, markRead, markAllRead };
}
