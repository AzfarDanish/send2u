import { useEffect } from 'react';

import { useUnreadCount } from '@/hooks/useUnreadCount';
import { setUnreadCount } from '@/lib/unread';

/**
 * Single writer for the shared unread count. Mount once per role layout —
 * the one realtime channel + head-count query feeds every bell. Resets on
 * unmount (sign-out / role switch) so no stale dot survives the session.
 */
export function UnreadSync() {
  const count = useUnreadCount();
  useEffect(() => {
    setUnreadCount(count);
    return () => {
      setUnreadCount(0);
    };
  }, [count]);
  return null;
}
