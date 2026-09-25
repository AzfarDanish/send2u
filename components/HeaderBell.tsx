import { router } from 'expo-router';

import { NotificationBell } from '@/components/NotificationBell';
import { useSharedUnreadCount } from '@/lib/unread';
import type { UserRole } from '@/types/domain';

/**
 * Header bell with a live unread dot; opens this role's notification
 * center. Reads the shared count — no query or channel of its own, so any
 * number of bells can mount without extra cost.
 *
 * `color`/`dotColor` are passthroughs for red headers; on white headers the
 * defaults keep the near-black glyph and red dot.
 */
export function HeaderBell({
  role,
  color,
  dotColor,
}: {
  role?: UserRole;
  color?: string;
  dotColor?: string;
}) {
  const unreadCount = useSharedUnreadCount();
  // Helper Portal shares the main notification center; there is no separate
  // helper notifications route anymore.
  void role;
  return (
    <NotificationBell
      unreadCount={unreadCount}
      onPress={() => router.push('/(requester)/notifications')}
      color={color}
      dotColor={dotColor}
    />
  );
}
