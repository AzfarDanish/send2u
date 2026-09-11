import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { expirePendingOffers, listMyOffers, respondToOffer } from '@/services/offers';
import type { JobOffer } from '@/types/domain';

export type OffersStatus = 'loading' | 'ready' | 'empty' | 'error';

export function useMyOffers() {
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [status, setStatus] = useState<OffersStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setStatus('loading');
    setError(null);
    try {
      const next = await listMyOffers();
      setOffers(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load offers');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const silentReload = useCallback(async () => {
    try {
      const next = await listMyOffers();
      setOffers(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch {
      // keep stale
    }
  }, []);

  useRealtimeReload([{ table: 'send2u_job_offers', event: '*' }], () => {
    void silentReload();
  });

  // Expire stale offers locally and advance dispatch without manual action.
  // The server gates accept/reject on expiry, but without this the UI would
  // show a stale pending row until the helper acts.
  useEffect(() => {
    const id = setInterval(() => {
      const hasExpiring = offers.some((o) => new Date(o.expiresAt).getTime() <= Date.now());
      if (!hasExpiring) return;
      void expirePendingOffers()
        .then((r) => {
          if (r.expired > 0) void silentReload();
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [offers, silentReload]);

  const retry = useCallback(() => void load(false), [load]);
  const refresh = useCallback(async () => load(true), [load]);

  const respond = useCallback(
    async (offerId: string, action: 'accepted' | 'rejected') => {
      await respondToOffer(offerId, action);
      await load(false);
    },
    [load],
  );

  return { offers, status, error, refreshing, retry, refresh, respond, reload: () => load(false) };
}
