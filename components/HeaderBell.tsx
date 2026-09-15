import { router } from 'expo-router';

import { NotificationBell } from '@/components/NotificationBell';
import { useSharedUnreadCount } from '@/lib/unread';
import type { UserRole } from '@/types/domain';

/**
 * Header bell with a live unread dot; opens this role's notification
 * center. Reads the shared count — no query or channel of its own, so any
 * number of bells can mount without extra cost.
 */
export function HeaderBell({ role }: { role: UserRole }) {
  const unreadCount = useSharedUnreadCount();
  return (
    <NotificationBell
      unreadCount={unreadCount}
      onPress={() =>
        router.push(role === 'helper' ? '/(helper)/notifications' : '/(requester)/notifications')
      }
    />
  );
}
