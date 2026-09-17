import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { getPaymentContext, submitPaymentEvidence, type PaymentContext } from '@/services/payments';
import { evidencePathFor, pickReceiptFile, removeObject, uploadObject } from '@/services/storage';
import type { PickedReceipt } from '@/services/storage';

export type PaymentFlowStatus = 'loading' | 'ready' | 'error';

interface UsePaymentFlowResult {
  context: PaymentContext | null;
  status: PaymentFlowStatus;
  error: string | null;
  /** Background refresh in flight while a context is already visible. */
  reloading: boolean;
  retry: () => void;
  /** Reload preserving visible content (used after mutations). */
  refresh: () => Promise<void>;
  busy: boolean;
  busyMessage: string | null;
  submitError: string | null;
  /** Picked-but-not-submitted receipt. Nothing uploads until confirm. */
  staged: PickedReceipt | null;
  cancelStaged: () => void;
  choose: () => Promise<void>;
  confirm: () => Promise<boolean>;
}

/**
 * Shared payment state machine: context load (stale-while-revalidate),
 * receipt staging, and submit with orphan cleanup. Drives both the inline
 * `RequesterPaymentCard` and the dedicated payment/receipt screens, so the
 * upload pipeline exists exactly once.
 */
export function usePaymentFlow(orderId: string, refreshToken = 0): UsePaymentFlowResult {
  const { user } = useAuth();
  const [context, setContext] = useState<PaymentContext | null>(null);
  const [status, setStatus] = useState<PaymentFlowStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  // Background refresh in flight while a context is already visible: callers
  // keep showing stale content with a small inline spinner instead of
  // flashing back to the full loading state.
  const [reloading, setReloading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasContext = useRef(false);
  const [staged, setStaged] = useState<PickedReceipt | null>(null);

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
      } catch (err) {
        // Background failures keep the stale view; foreground failures
        // (first mount, explicit retry) surface the error state.
        if (!background || !hasContext.current) {
          setError(err instanceof Error ? err.message : 'Could not load payment details.');
          setStatus('error');
        }
      } finally {
        setReloading(false);
      }
    },
    [orderId],
  );

  // Timestamp of the last token-driven refetch. The focus effect below
  // skips its own refetch within a short window after one — the token
  // effect already covers it, so returning to the screen doesn't fetch
  // twice for the same update.
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
          setError(err instanceof Error ? err.message : 'Could not load payment details.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshToken]);

  const retry = useCallback(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load({ background: true });
  }, [load]);

  const choose = useCallback(async () => {
    if (!user || busy) return;
    setBusy(true);
    setBusyMessage('Choosing receipt…');
    setSubmitError(null);
    try {
      const picked = await pickReceiptFile();
      if (picked) setStaged(picked);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not choose the receipt.');
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  }, [user, busy]);

  // Previously submitted receipt, if any (a rejected payment can be
  // resubmitted): removed before the new file is saved so a resubmit never
  // leaves two live evidence files behind.
  const previousEvidence = context?.payment?.evidencePath ?? null;

  const confirm = useCallback(async (): Promise<boolean> => {
    if (!user || busy || !staged) return false;
    setBusy(true);
    setSubmitError(null);
    let removedPrevious = false;
    let uploadedPath: string | null = null;
    try {
      if (previousEvidence) {
        setBusyMessage('Removing old receipt…');
        try {
          await removeObject(previousEvidence);
        } catch {
          throw new Error('Could not remove the old receipt. Nothing was changed. Try again.');
        }
        removedPrevious = true;
      }
      const path = evidencePathFor(user.id, orderId, staged.extension, staged.fileName);
      setBusyMessage('Uploading receipt…');
      await uploadObject(path, staged);
      uploadedPath = path;
      setBusyMessage('Submitting…');
      await submitPaymentEvidence(orderId, path);
      setStaged(null);
      // Background reconcile: the RPC returns only amount+status (not the
      // full payment row), so refetch — preserving the visible view with an
      // inline spinner instead of blanking it.
      await load({ background: true });
      return true;
    } catch (err) {
      if (uploadedPath) {
        try {
          await removeObject(uploadedPath);
        } catch {
          // Orphaned upload is harmless; the payment row was never created.
        }
      }
      if (removedPrevious) {
        setSubmitError(
          'The old receipt was removed but the new one could not be submitted. Please choose the receipt again.',
        );
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Could not submit payment evidence.');
      }
      return false;
    } finally {
      setBusy(false);
      setBusyMessage(null);
    }
  }, [user, busy, staged, orderId, load, previousEvidence]);

  const cancelStaged = useCallback(() => {
    setStaged(null);
  }, []);

  return {
    context,
    status,
    error,
    reloading,
    retry,
    refresh,
    busy,
    busyMessage,
    submitError,
    staged,
    cancelStaged,
    choose,
    confirm,
  };
}
