import { router } from 'expo-router';

import { NotificationBell } from '@/components/NotificationBell';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import type { UserRole } from '@/types/domain';

/** Header bell with a live unread dot; opens this role's notification center. */
export function HeaderBell({ role }: { role: UserRole }) {
  const unreadCount = useUnreadCount();
  return (
    <NotificationBell
      unreadCount={unreadCount}
      onPress={() =>
        router.push(role === 'helper' ? '/(helper)/notifications' : '/(requester)/notifications')
      }
    />
  );
}
