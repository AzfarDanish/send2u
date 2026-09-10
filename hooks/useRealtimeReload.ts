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
 * match, on (re)subscribe (reconnect reconciliation), and never otherwise.
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
  saved.current = onEvent;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topicsKey = JSON.stringify(topics);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
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
      if (status === 'SUBSCRIBED') fire();
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
