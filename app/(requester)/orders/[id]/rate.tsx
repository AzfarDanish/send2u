import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { HelperIdentity } from '@/components/HelperIdentity';
import { OrderRatingSection } from '@/components/OrderRatingSection';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { GlassHeader } from '@/components/GlassHeader';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useHelperIdentity } from '@/hooks/useHelperIdentity';
import { getOrderDetail } from '@/services/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * Rate Your Helper: real helper identity plus the shared rating section
 * (5-star input, optional 500-char comment, once-per-order immutable).
 * Gated to completed + verified-payment orders for the owning requester —
 * the same eligibility the section itself enforces.
 */
export default function OrderRateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const orderId = typeof id === 'string' ? id : null;
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const {
    identity,
    status: identityStatus,
    retry: retryIdentity,
  } = useHelperIdentity(orderId ?? '', order?.helperId ?? null);

  // Mount + retry fetch. Inlined rather than a state-setting callback: a
  // useEffect body may not call one — state sets here live only in the
  // async continuation.
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) setStatus('loading');
      if (!orderId) return;
      try {
        const found = await getOrderDetail(orderId);
        if (mounted) {
          setOrder(found);
          setLoadFailed(false);
          setStatus(found ? 'ready' : 'missing');
        }
      } catch {
        if (mounted) {
          setOrder(null);
          setLoadFailed(true);
          setStatus('missing');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orderId, refreshToken]);

  // Ratings can land while this screen is mounted (the other party rates
  // from their side) — refetch silently so the section below reconciles.
  // Skipped on first mount: the mount fetch above already covers it.
  const firstFocusRun = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRun.current) {
        firstFocusRun.current = false;
        return;
      }
      void getOrderDetail(orderId ?? '')
        .then((found) => {
          setOrder(found);
          if (found) {
            setLoadFailed(false);
            setStatus('ready');
          }
        })
        .catch(() => {
          // Keep the visible order; explicit retry surfaces errors.
        });
    }, [orderId]),
  );

  if (!orderId) {
    return (
      <>
        <GlassHeader title="Rate Your Helper" />
        <Screen beneathHeader>
          <ErrorState
            title="Request not found"
            message="This request isn't available to you."
            retryTitle="Back to requests"
            onRetry={() => router.push('/(requester)/orders')}
          />
        </Screen>
      </>
    );
  }

  const eligible =
    order !== null &&
    user?.id === order.requesterId &&
    order.status === 'completed' &&
    order.payment?.status === 'verified' &&
    !order.resolvedAt &&
    !!order.helperId;

  return (
    <>
      <GlassHeader title="Rate Your Helper" />
      <Screen beneathHeader>
        {status === 'loading' || !order ? (
          status === 'loading' ? (
            <LoadingState message="Loading request…" />
          ) : loadFailed ? (
            <ErrorState
              title="Couldn't load the request"
              message="Check your connection and try again."
              retryTitle="Try again"
              onRetry={() => setRefreshToken((t) => t + 1)}
            />
          ) : (
            <ErrorState
              title="Request not found"
              message="This request isn't available to you."
              retryTitle="Back to requests"
              onRetry={() => router.push('/(requester)/orders')}
            />
          )
        ) : !eligible ? (
          <EmptyState
            icon="star-border"
            title="Rating not available"
            message="Rating opens once the request is completed and paid."
            actionTitle="Back to request"
            onAction={() => router.back()}
          />
        ) : (
          <>
            <Card>
              <HelperIdentity
                identity={identity}
                helperId={order.helperId}
                caption="Delivered your request — how was the experience?"
                loadFailed={identityStatus === 'error'}
                onRetry={retryIdentity}
              />
            </Section>
            <OrderRatingSection order={order} refreshToken={refreshToken} requesterForm="inline" />
            <Button title="Back to Request" variant="secondary" onPress={() => router.back()} />
          </>
        )}
      </Screen>
    </>
  );
}
