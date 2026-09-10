import { useCallback, useEffect, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { countUnreadNotifications } from '@/services/notifications';

/**
 * Live unread-notification count for header indicators. Head-only query plus
 * a realtime subscription; silent on failure (a missing dot never blocks
 * anything — the center screen is the source of truth).
 */
export function useUnreadCount(enabled = true): number {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      setCount(await countUnreadNotifications());
    } catch {
      // Client may be signed out or offline; keep the last count.
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  useRealtimeReload([{ table: 'send2u_notifications', event: '*' }], load, enabled);

  return count;
}
