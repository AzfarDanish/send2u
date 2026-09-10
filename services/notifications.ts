import { getSupabaseClient } from '@/lib/supabase';

/**
 * Notification service layer (in-app center + push outbox reads).
 *
 * Rows are written exclusively by the database trigger
 * (`send2u_orders_notify_event`) on authoritative status changes — clients
 * hold no INSERT/DELETE grants and can only read their own rows and mark
 * them read. RLS enforces recipient isolation server-side.
 */

export interface AppNotification {
  id: string;
  orderId: string;
  kind: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  order_id: string;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}

function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    orderId: row.order_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/** Own notifications, newest first. RLS scopes to the caller. */
export async function listMyNotifications(limit = 100): Promise<AppNotification[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('send2u_notifications')
    .select('id, order_id, kind, title, body, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load notifications: ${error.message}`);
  return (data as unknown as NotificationRow[]).map(toNotification);
}

/** Number of unread own notifications. RLS scopes to the caller. */
export async function countUnreadNotifications(): Promise<number> {
  const supabase = requireClient();
  const { count, error } = await supabase
    .from('send2u_notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw new Error(`Could not count notifications: ${error.message}`);
  return count ?? 0;
}

/** Marks one own notification read. RLS rejects other users' rows. */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from('send2u_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  if (error) throw new Error(`Could not mark notification read: ${error.message}`);
}

/** Marks all own unread notifications read. RLS scopes to the caller. */
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from('send2u_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(`Could not mark notifications read: ${error.message}`);
}
