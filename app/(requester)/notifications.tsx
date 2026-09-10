import { NotificationCenter } from '@/components/NotificationCenter';

/** Requester notification center: authoritative order updates, read/unread. */
export default function RequesterNotificationsScreen() {
  return <NotificationCenter role="requester" />;
}
