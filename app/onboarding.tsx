import { router, type Href } from 'expo-router';
import { useCallback } from 'react';

import { OnboardingFlow } from '@/components/OnboardingFlow';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { SkeletonDetail } from '@/components/ui/LoadingBlocks';
import { useAuth } from '@/hooks/useAuth';
import { markOnboardingComplete } from '@/lib/onboarding';

/**
 * The one-time walkthrough as a real route (deep-linkable, and the landing
 * spot if the flow is ever opened outside signup). `/` renders the same
 * `OnboardingFlow` in place for a freshly created account, so this route is
 * a peer entry, not a duplicate implementation.
 *
 * No auto-redirect: a signed-out visitor is told to sign in and offered the
 * control, rather than being bounced somewhere they did not ask for.
 */
export default function OnboardingScreen() {
  const { user, role, isLoading } = useAuth();
  const destination: Href = role === 'vendor' ? '/(vendor)' : '/(requester)';

  const finish = useCallback(() => {
    const userId = user?.id;
    if (userId) void markOnboardingComplete(userId);
    router.replace(destination);
  }, [destination, user?.id]);

  if (isLoading) {
    return (
      <Screen>
        <SkeletonDetail label="Getting Send2U ready" />
      </Screen>
    );
  }

  if (!user) {
    return (
      <Screen>
        <ErrorState
          title="Sign in to continue"
          message="The walkthrough belongs to an account. Sign in, then you can open it again."
          retryTitle="Go to sign in"
          onRetry={() => router.push('/(auth)/sign-in')}
        />
      </Screen>
    );
  }

  return <OnboardingFlow onFinish={finish} />;
}
