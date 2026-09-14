import { useCallback, useEffect, useState } from 'react';

import { getMyVendor, updateVendorProfile, type VendorProfileInput } from '@/services/vendor';
import type { Vendor } from '@/types/domain';

export type MyVendorStatus = 'loading' | 'ready' | 'error';

interface UseMyVendorResult {
  vendor: Vendor | null;
  status: MyVendorStatus;
  error: string | null;
  saving: boolean;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
  save: (input: VendorProfileInput) => Promise<void>;
  /**
   * Optimistic local patch (e.g. open/closed flip): merges into the
   * visible vendor immediately; callers roll back with the previous
   * value when the write fails. No fetching involved.
   */
  patchVendor: (patch: Partial<Vendor>) => void;
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
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setStatus('loading');
    }
    setError(null);
    try {
      setVendor(await getMyVendor());
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your stall.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
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

  const patchVendor = useCallback((patch: Partial<Vendor>) => {
    setVendor((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return {
    vendor,
    status,
    error,
    saving,
    refreshing,
    retry: () => void load(false),
    refresh: async () => {
      await load(true);
    },
    save,
    patchVendor,
  };
}
