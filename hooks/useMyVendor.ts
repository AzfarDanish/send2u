import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
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
 * The signed-in vendor's own stall. `save` writes through the profile RPC
 * and reloads; tab revisits refetch silently and the own stall row is
 * watched live (an administrator hiding the stall, or an edit from another
 * device, arrives without a manual reload). Unlinked accounts surface the
 * service's "no stall linked" error as their empty state.
 */
export function useMyVendor(): UseMyVendorResult {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [status, setStatus] = useState<MyVendorStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // True once any load succeeded: focus returns then refresh silently
  // instead of flashing the skeleton over visible stall data.
  const hasLoaded = useRef(false);

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
      hasLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your stall.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Preserving background refetch for focus returns and realtime events.
  // Never blanks; failures keep stale rows.
  const silentReload = useCallback(async () => {
    try {
      setVendor(await getMyVendor());
      setError(null);
      setStatus('ready');
      hasLoaded.current = true;
    } catch {
      // Keep stale data.
    }
  }, []);

  // Tab revisits would otherwise show a stale stall (or miss an admin
  // hide). Replaces the mount fetch — focus fires on mount too.
  useFocusEffect(
    useCallback(() => {
      if (hasLoaded.current) void silentReload();
      else void load(false);
    }, [load, silentReload]),
  );

  // Own stall row only, RLS-scoped server-side: the vendor SELECT policies
  // expose exactly the linked stall, so an unfiltered subscription is safe
  // and no other stall's rows can ever arrive.
  useRealtimeReload([{ table: 'send2u_vendors', event: '*' }], () => {
    void silentReload();
  });

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
