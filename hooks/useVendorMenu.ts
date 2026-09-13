import { useCallback, useEffect, useState } from 'react';

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

  useRealtimeReload(
    [{ table: 'send2u_menu_items', event: '*' }],
    () => void load(true),
  );

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  const saveItem = useCallback(
    async (itemId: string | null, input: MenuItemInput) => {
      await upsertMenuItem(itemId, input);
      await load(true);
    },
    [load],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await deleteMenuItem(itemId);
      await load(true);
    },
    [load],
  );

  const setAvailability = useCallback(
    async (itemId: string, isAvailable: boolean) => {
      const current = items.find((item) => item.id === itemId);
      if (!current) throw new Error('That item is no longer on your menu. Pull to refresh.');
      await upsertMenuItem(itemId, {
        name: current.name,
        description: current.description,
        priceCents: current.priceCents,
        isAvailable,
      });
      await load(true);
    },
    [items, load],
  );

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
