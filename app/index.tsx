import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { OnboardingPermissions } from '@/components/auth/OnboardingPermissions';
import { Screen } from '@/components/ui/Screen';
import { SkeletonForm } from '@/components/ui/LoadingBlocks';
import { useAuth } from '@/hooks/useAuth';
import {
  isPermissionsOnboardingPending,
  markPermissionsOnboardingDone,
} from '@/lib/onboardingPermissions';

export default function IndexScreen() {
  const { user, role, isLoading, signOut } = useAuth();
  // Device-local onboarding flag, keyed by account: null until read for
  // the current user. Keying avoids flashing the previous account's value
  // across sign-out/sign-in without a reload.
  const [onboarding, setOnboarding] = useState<{ userId: string; pending: boolean } | null>(
    null,
  );

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

  useEffect(() => {
    if (!user) return;
    if (onboarding?.userId === user.id) return;
    let cancelled = false;
    void (async () => {
      const pending = await isPermissionsOnboardingPending(user.id);
      if (!cancelled) setOnboarding({ userId: user.id, pending });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, onboarding]);

  const gateReady = !user || (onboarding !== null && onboarding.userId === user.id);
  if (isLoading || (user && !role) || !gateReady) {
    return (
      <Screen>
        <SkeletonForm fields={2} label="Loading Send2U" />
      </Screen>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // Fresh requester signups tap through notifications + location first.
  // Rendered in place (never pushed), so signup cannot race the routing
  // and Back can never return to the prompts. Completing flips local
  // state, and the role redirect below takes over.
  const onboardingPending = onboarding !== null && onboarding.pending;
  if (onboardingPending && (role === 'requester' || role === 'helper')) {
    return (
      <OnboardingPermissions
        onComplete={() => {
          if (!user) return;
          const userId = user.id;
          void (async () => {
            await markPermissionsOnboardingDone(userId);
            setOnboarding({ userId, pending: false });
          })();
        }}
      />
    );
  }

  return <Redirect href={role === 'vendor' ? '/(vendor)' : '/(requester)'} />;
}
