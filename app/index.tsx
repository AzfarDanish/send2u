import { Redirect } from 'expo-router';
import { useEffect } from 'react';

import { Screen } from '@/components/ui/Screen';
import { SkeletonForm } from '@/components/ui/LoadingBlocks';
import { useAuth } from '@/hooks/useAuth';

export default function IndexScreen() {
  const { user, role, isLoading, signOut } = useAuth();

  useEffect(() => {
    if (isLoading || !user || role) return;
    let cancelled = false;
    void (async () => {
      try {
        await signOut();
      } catch {
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, user, role, signOut]);

  if (isLoading || (user && !role)) {
    return (
      <Screen>
        <SkeletonForm fields={2} label="Loading Send2U" />
      </Screen>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href={role === 'vendor' ? '/(vendor)' : '/(requester)'} />;
}
