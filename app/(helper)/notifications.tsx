import { NotificationCenter } from '@/components/NotificationCenter';

/**
 * Helper notification center: authoritative order updates, read/unread.
 * Custom glass nav bar (the route hides the native header).
 */
export default function HelperNotificationsScreen() {
  return <NotificationCenter role="helper" header="custom" />;
}
