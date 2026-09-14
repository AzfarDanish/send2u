import { useCallback, useEffect, useRef, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { deleteMenuItem, listMyMenuItems, upsertMenuItem, type MenuItemInput } from '@/services/vendor';
import type { MenuItem } from '@/types/domain';

export type VendorMenuStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseVendorMenuResult {
  items: MenuItem[];
  status: VendorMenuStatus;
  error: string | null;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
  saveItem: (itemId: string | null, input: MenuItemInput) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  setAvailability: (itemId: string, isAvailable: boolean) => Promise<void>;
}

/**
 * The signed-in vendor's own menu. Reloads live on row changes (including
 * the vendor's own edits from this device) and on pull-to-refresh.
 * Availability toggles round-trip through the upsert RPC so the requester
 * menu sees the same rows this list shows.
 */
export function useVendorMenu(): UseVendorMenuResult {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [status, setStatus] = useState<VendorMenuStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setStatus('loading');
    }
    setError(null);
    try {
      const next = await listMyMenuItems();
      setItems(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your menu.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  // Silent background refetch: preserves visible rows (no spinner flash)
  // and keeps stale data on failure. Used for realtime echoes and
  // membership changes the local patch can't determine.
  const silentReload = useCallback(async () => {
    try {
      const next = await listMyMenuItems();
      setItems(next);
      setStatus(next.length === 0 ? 'empty' : 'ready');
    } catch {
      // Keep stale data.
    }
  }, []);

  useRealtimeReload([{ table: 'send2u_menu_items', event: '*' }], () => {
    void silentReload();
  });

  // Latest items for mutation callbacks (synced in an effect — refs must
  // not be written during render). Keeps callbacks stable so rows don't
  // re-render on every list change.
  const itemsRef = useRef<MenuItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  const saveItem = useCallback(async (itemId: string | null, input: MenuItemInput) => {
    // The RPC returns the authoritative row: patch it in directly (replace
    // on edit, append on create — realtime reconciles ordering). Failure
    // leaves the list untouched; the form stays open with its inputs.
    const saved = await upsertMenuItem(itemId, input);
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === saved.id);
      if (index === -1) return [...prev, saved];
      const next = prev.slice();
      next[index] = saved;
      return next;
    });
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    // Destructive: mutate local state only after the server confirms.
    // Failure leaves the row in place; the screen shows the error.
    await deleteMenuItem(itemId);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const setAvailability = useCallback(async (itemId: string, isAvailable: boolean) => {
    const current = itemsRef.current.find((item) => item.id === itemId);
    if (!current) throw new Error('That item is no longer on your menu. Pull to refresh.');
    // Optimistic flip: the switch reflects the tap instantly (safe and
    // reversible), the authoritative row reconciles on success, and the
    // previous value is restored on failure.
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, isAvailable } : item)));
    try {
      const saved = await upsertMenuItem(itemId, {
        name: current.name,
        description: current.description,
        priceCents: current.priceCents,
        isAvailable,
      });
      setItems((prev) => prev.map((item) => (item.id === itemId ? saved : item)));
    } catch (err) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, isAvailable: current.isAvailable } : item,
        ),
      );
      throw err;
    }
  }, []);

  return {
    items,
    status,
    error,
    refreshing,
    retry: () => void load(false),
    refresh: reload,
    saveItem,
    removeItem,
    setAvailability,
  };
}
