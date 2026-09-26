import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { useMyDeliveryHistory } from '@/hooks/useMyDeliveryHistory';
import {
  completedDeliveryCount,
  helperRatingSummary,
  settledEarningsCents,
} from '@/lib/helperStats';
import { listReceivedRatings } from '@/services/ratings';
import type { Rating } from '@/types/domain';

export type HelperStatsStatus = 'loading' | 'ready' | 'error';

export interface HelperStats {
  /** Deliveries this helper completed. Cancelled and disputed are excluded. */
  deliveries: number;
  /** Null until something has actually been rated — never a stand-in 5.0. */
  rating: { average: number; count: number } | null;
  /** Delivery fees on completed, settled orders. */
  earningsCents: number;
}

interface UseHelperStatsResult {
  stats: HelperStats;
  status: HelperStatsStatus;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY: HelperStats = { deliveries: 0, rating: null, earningsCents: 0 };

/**
 * The Helper Portal profile's three figures.
 *
 * All three come from data the backend already holds: the helper's terminal
 * deliveries (via `useMyDeliveryHistory`, which the Deliveries tab uses too)
 * and the ratings left on those deliveries. The rating is intersected with this
 * helper's own delivery ids, so a score this account received as a requester
 * cannot inflate it.
 *
 * An unrated helper reports `rating: null` and the screen prints a dash: absent
 * data is shown as absent, not as a perfect score.
 *
 * Ratings load through a promise inside the focus effect rather than from a
 * synchronous call in the effect body: the delivery history keeps its rows on
 * screen while this refreshes, and no state is set during the effect itself.
 */
export function useHelperStats(enabled = true): UseHelperStatsResult {
  const { user } = useAuth();
  const history = useMyDeliveryHistory(enabled);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  const loadRatings = useCallback(async () => {
    if (!userId) return;
    try {
      setRatings(await listReceivedRatings(userId));
      setRatingsError(null);
    } catch (err) {
      // The rating line shows a dash and this message; deliveries and earnings
      // still render, because one unreadable figure must not blank the screen.
      setRatingsError(err instanceof Error ? err.message : 'Could not load your rating.');
      setRatings([]);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !userId) return;
      let cancelled = false;
      void listReceivedRatings(userId)
        .then((next) => {
          if (cancelled) return;
          setRatings(next);
          setRatingsError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setRatingsError(err instanceof Error ? err.message : 'Could not load your rating.');
          setRatings([]);
        });
      return () => {
        cancelled = true;
      };
    }, [enabled, userId]),
  );

  const stats = useMemo<HelperStats>(
    () => ({
      deliveries: completedDeliveryCount(history.deliveries),
      rating: helperRatingSummary(history.deliveries, ratings),
      earningsCents: settledEarningsCents(history.deliveries),
    }),
    [history.deliveries, ratings],
  );

  const refresh = useCallback(async () => {
    await Promise.all([history.refresh(), loadRatings()]);
  }, [history, loadRatings]);

  const status: HelperStatsStatus =
    history.status === 'error' ? 'error' : history.status === 'loading' ? 'loading' : 'ready';

  return {
    stats: history.status === 'loading' ? EMPTY : stats,
    status,
    error: history.error ?? ratingsError,
    refresh,
  };
}
