import { useCallback, useEffect, useState } from 'react';

import { getHelperIdentity, type HelperIdentity } from '@/services/helperIdentity';

export type HelperIdentityStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseHelperIdentityResult {
  identity: HelperIdentity | null;
  status: HelperIdentityStatus;
  error: string | null;
  retry: () => void;
}

/**
 * Helper display identity for one order. Empty (not error) when no helper
 * is assigned yet — assignment arrives through the parent order reload,
 * which passes the new helperId and retriggers this fetch.
 */
export function useHelperIdentity(
  orderId: string,
  helperId: string | null,
): UseHelperIdentityResult {
  const [identity, setIdentity] = useState<HelperIdentity | null>(null);
  const [status, setStatus] = useState<HelperIdentityStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!helperId) {
        if (!cancelled) {
          setIdentity(null);
          setStatus('empty');
        }
        return;
      }
      if (!cancelled) {
        setStatus('loading');
        setError(null);
      }
      try {
        const next = await getHelperIdentity(orderId);
        if (!cancelled) {
          setIdentity(next);
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setIdentity(null);
          setError(err instanceof Error ? err.message : 'Could not load helper details.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, helperId, retryToken]);

  const retry = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  return { identity, status, error, retry };
}
