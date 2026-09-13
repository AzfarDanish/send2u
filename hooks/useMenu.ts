import { useCallback, useEffect, useState } from 'react';

import { useRealtimeReload } from '@/hooks/useRealtimeReload';
import { listVendorSections } from '@/services/menu';
import type { VendorMenuSection } from '@/types/domain';

export type MenuStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseMenuResult {
  sections: VendorMenuSection[];
  itemCount: number;
  status: MenuStatus;
  error: string | null;
  refreshing: boolean;
  retry: () => void;
  refresh: () => Promise<void>;
}

/**
 * Requester menu state. Loads once on mount; refresh is explicit
 * (pull-to-refresh / retry) plus silent live reloads when vendors or
 * items change (a vendor editing their stall updates this menu without
 * any new notification traffic).
 */
export function useMenu(): UseMenuResult {
  const [sections, setSections] = useState<VendorMenuSection[]>([]);
  const [status, setStatus] = useState<MenuStatus>('loading');
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
      const next = await listVendorSections();
      setSections(next);
      const total = next.reduce((sum, section) => sum + section.items.length, 0);
      setStatus(total === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the menu.');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useRealtimeReload(
    [
      { table: 'send2u_vendors', event: '*' },
      { table: 'send2u_menu_items', event: '*' },
    ],
    () => void load(true),
  );

  const retry = useCallback(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0);

  return { sections, itemCount, status, error, refreshing, retry, refresh };
}
