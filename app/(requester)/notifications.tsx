import { NotificationCenter } from '@/components/NotificationCenter';

/**
 * Requester notification center: authoritative order updates, read/unread.
 * Custom in-screen nav bar (the route hides the native header).
 */
export default function RequesterNotificationsScreen() {
  return <NotificationCenter role="requester" header="custom" />;
}
