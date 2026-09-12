import { useEffect, useRef } from 'react';

import { getSupabaseClient } from '@/lib/supabase';

export interface RealtimeTopic {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  /** PostgREST-style filter, e.g. `id=eq.abc`. Omit for RLS-scoped all-rows. */
  filter?: string;
}

/**
 * Subscribes to Postgres changes and invokes `onEvent` (debounced) on any
 * match and on re-subscribe (reconnect reconciliation) — but NOT on the
 * initial subscribe, since the caller just loaded and firing there would
 * double every mount fetch. Never fires otherwise.
 *
 * Security: RLS still applies server-side — the client only receives rows it
 * may SELECT, so an unfiltered subscription is safe. Failures (realtime
 * unavailable, offline) are silent by design: every screen keeps its
 * focus/pull-to-refresh loading as the source of truth, so the app stays
 * fully usable with realtime down.
 */
export function useRealtimeReload(
  topics: RealtimeTopic[],
  onEvent: () => void,
  enabled = true,
): void {
  const saved = useRef(onEvent);
  // Synced in an effect (never written during render): readers only run in
  // async callbacks (debounce timer, channel events), which always execute
  // after commit, so this is identical in practice.
  useEffect(() => {
    saved.current = onEvent;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether the channel has completed its first subscribe, so the
  // initial SUBSCRIBED (data was just loaded by the caller) is skipped while
  // later re-subscribes (reconnects) still trigger a reconciling reload.
  const hasSubscribedOnce = useRef(false);
  const topicsKey = JSON.stringify(topics);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    // Fresh channel below: its first SUBSCRIBED must be skipped (see below).
    hasSubscribedOnce.current = false;
    const parsed: RealtimeTopic[] = JSON.parse(topicsKey) as RealtimeTopic[];
    if (parsed.length === 0) return;

    const fire = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        saved.current();
      }, 400);
    };

    // Unique channel per mount so independent screens never unsubscribe each
    // other; the socket itself is still shared by the client.
    const channel = supabase.channel(
      `send2u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    );
    for (const topic of parsed) {
      channel.on(
        'postgres_changes',
        {
          event: topic.event ?? '*',
          schema: 'public',
          table: topic.table,
          ...(topic.filter ? { filter: topic.filter } : {}),
        },
        fire,
      );
    }
    channel.subscribe((status) => {
      // Reconnect reconciliation only: the caller already loaded on mount,
      // so firing on the FIRST subscribe would fetch everything twice.
      // Later re-subscribes (socket reconnect) still refetch, which heals
      // missed events while offline.
      if (status !== 'SUBSCRIBED') return;
      if (!hasSubscribedOnce.current) {
        hasSubscribedOnce.current = true;
        return;
      }
      fire();
    });

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [enabled, topicsKey]);
}
