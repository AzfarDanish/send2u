import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { getSupabaseClient } from '@/lib/supabase';
import {
  completeOnlinePayment,
  confirmCodCollection,
  getPaymentContext,
  initiateOnlinePayment,
  type TransactionContext,
} from '@/services/payments';

export type TransactionStatus = 'loading' | 'ready' | 'error';
export type OnlinePayPhase = 'idle' | 'starting' | 'processing' | 'success' | 'failed';

interface UseTransactionResult {
  context: TransactionContext | null;
  status: TransactionStatus;
  error: string | null;
  reloading: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
  /** Simulated online payment state machine (initiate → processing → done). */
  payPhase: OnlinePayPhase;
  payBusy: boolean;
  pay: (simulateFailure?: boolean) => Promise<boolean>;
  resetPayPhase: () => void;
  /** COD cash collection (helper). Safe against double taps. */
  collecting: boolean;
  collectCash: () => Promise<boolean>;
  actionError: string | null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Platform transaction state: loads the authoritative transaction context
 * and keeps it fresh via realtime (orders + payments + settlements) and
 * focus refetch. Online payment is a simulated async flow persisted through
 * RPCs — never local-only state. COD collection is an explicit idempotent
 * transaction event.
 */
export function useTransaction(orderId: string, refreshToken = 0): UseTransactionResult {
  const { session } = useAuth();
  const [context, setContext] = useState<TransactionContext | null>(null);
  const [status, setStatus] = useState<TransactionStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [payPhase, setPayPhase] = useState<OnlinePayPhase>('idle');
  const [payBusy, setPayBusy] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const hasContext = useRef(false);
  const payAttemptRef = useRef(0);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      const background = opts?.background ?? false;
      if (background && hasContext.current) {
        setReloading(true);
      } else {
        setStatus('loading');
        setError(null);
      }
      try {
        const next = await getPaymentContext(orderId);
        setContext(next);
        hasContext.current = true;
        setStatus('ready');
        if (next.paymentStatus === 'paid' || next.paymentStatus === 'collected') {
          setPayPhase((phase) => (phase === 'processing' || phase === 'starting' ? 'success' : phase));
        }
      } catch (err) {
        if (!background || !hasContext.current) {
          setError(err instanceof Error ? err.message : 'Could not load transaction details.');
          setStatus('error');
        }
      } finally {
        setReloading(false);
      }
    },
    [orderId],
  );

  const tokenBumpAt = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - tokenBumpAt.current < 1500) return;
      void load({ background: true });
    }, [load]),
  );

  useEffect(() => {
    if (refreshToken <= 0) return;
    tokenBumpAt.current = Date.now();
    let cancelled = false;
    (async () => {
      try {
        const next = await getPaymentContext(orderId);
        if (!cancelled) {
          setContext(next);
          hasContext.current = true;
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled && !hasContext.current) {
          setError(err instanceof Error ? err.message : 'Could not load transaction details.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshToken]);

  // Realtime: any change to this order's row, payment row, or settlement row
  // refreshes the context. Silent failure by design — focus refetch covers it.
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !session) return;
    let cancelled = false;
    const channel = supabase
      .channel(`send2u:txn:${orderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'send2u_orders', filter: `id=eq.${orderId}` },
        () => {
          if (!cancelled) void load({ background: true });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'send2u_payments', filter: `order_id=eq.${orderId}` },
        () => {
          if (!cancelled) void load({ background: true });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'send2u_settlements',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          if (!cancelled) void load({ background: true });
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [orderId, session, load]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load({ background: true });
  }, [load]);

  const pay = useCallback(
    async (simulateFailure = false): Promise<boolean> => {
      const attempt = payAttemptRef.current + 1;
      payAttemptRef.current = attempt;
      if (payBusy) return false;
      // Already resolved — never re-charge.
      if (context && (context.paymentStatus === 'paid' || context.paymentStatus === 'collected')) {
        setPayPhase('success');
        return true;
      }
      setPayBusy(true);
      setActionError(null);
      setPayPhase('starting');
      try {
        const intent = await initiateOnlinePayment(orderId);
        if (payAttemptRef.current !== attempt) return false;
        if (intent.status === 'paid') {
          setPayPhase('success');
          await load({ background: true });
          return true;
        }
        setPayPhase('processing');
        // Simulated provider round-trip: the record already exists as
        // pending in Supabase; completion lands after a realistic beat.
        await wait(1600);
        if (payAttemptRef.current !== attempt) return false;
        const done = await completeOnlinePayment(orderId, intent.providerRef ?? '', !simulateFailure);
        if (payAttemptRef.current !== attempt) return false;
        await load({ background: true });
        if (done.status === 'paid') {
          setPayPhase('success');
          return true;
        }
        setPayPhase('failed');
        setActionError('The simulated payment failed. You were not charged — try again.');
        return false;
      } catch (err) {
        if (payAttemptRef.current !== attempt) return false;
        setPayPhase('failed');
        setActionError(err instanceof Error ? err.message : 'Payment failed. Try again.');
        return false;
      } finally {
        if (payAttemptRef.current === attempt) setPayBusy(false);
      }
    },
    [orderId, payBusy, context, load],
  );

  const resetPayPhase = useCallback(() => {
    payAttemptRef.current += 1;
    setPayPhase('idle');
    setActionError(null);
  }, []);

  const collectCash = useCallback(async (): Promise<boolean> => {
    if (collecting) return false;
    if (context?.paymentStatus === 'collected') return true;
    setCollecting(true);
    setActionError(null);
    try {
      await confirmCodCollection(orderId);
      await load({ background: true });
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not record cash collection.');
      return false;
    } finally {
      setCollecting(false);
    }
  }, [orderId, collecting, context, load]);

  return {
    context,
    status,
    error,
    reloading,
    retry,
    refresh,
    payPhase,
    payBusy,
    pay,
    resetPayPhase,
    collecting,
    collectCash,
    actionError,
  };
}
