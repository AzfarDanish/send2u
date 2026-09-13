import { useCallback, useEffect, useState } from 'react';

import { getMyVendor, updateVendorProfile, type VendorProfileInput } from '@/services/vendor';
import type { Vendor } from '@/types/domain';

export type MyVendorStatus = 'loading' | 'ready' | 'error';

interface UseMyVendorResult {
  vendor: Vendor | null;
  status: MyVendorStatus;
  error: string | null;
  saving: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
  save: (input: VendorProfileInput) => Promise<void>;
}

/**
 * The signed-in vendor's own stall. Loads once on mount; `save` writes
 * through the profile RPC and reloads. Unlinked accounts surface the
 * service's "no stall linked" error as their empty state.
 */
export function useMyVendor(): UseMyVendorResult {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [status, setStatus] = useState<MyVendorStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setVendor(await getMyVendor());
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your stall.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (input: VendorProfileInput) => {
    setSaving(true);
    try {
      setVendor(await updateVendorProfile(input));
      setError(null);
      setStatus('ready');
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    vendor,
    status,
    error,
    saving,
    retry: () => void load(),
    refresh: load,
    save,
  };
}
