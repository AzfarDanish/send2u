import { useCallback, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { setHelperAvailability } from '@/services/availability';

export function useHelperAvailability() {
  const { profile, refreshProfile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAvailable = profile?.isAvailable ?? false;

  const setAvailable = useCallback(
    async (next: boolean) => {
      setUpdating(true);
      setError(null);
      try {
        await setHelperAvailability(next);
        await refreshProfile();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update availability');
        throw err;
      } finally {
        setUpdating(false);
      }
    },
    [refreshProfile],
  );

  return { isAvailable, updating, error, setAvailable };
}
