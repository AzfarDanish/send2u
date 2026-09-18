import { Redirect, router } from 'expo-router';
import type { ReactNode } from 'react';

import { GlassHeader } from '@/components/GlassHeader';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';

interface HelperPortalGuardProps {
  /** Screen title for the glass header (loading/denied states included). */
  title: string;
  children: ReactNode;
}

/**
 * Capability gate for every Helper Portal screen. Verified helpers
 * (requester + is_verified_helper) pass through; normal requesters get an
 * honest access-denied state with a way back — never a fake disabled
 * portal. Backend RLS/RPCs enforce the same capability server-side, so
 * manual deep-link navigation cannot bypass this.
 */
export function HelperPortalGuard({ title, children }: HelperPortalGuardProps) {
  const { user, isVerifiedHelper, isLoading } = useAuth();

  if (isLoading) {
    return (
      <>
        <GlassHeader title={title} />
        <Screen beneathHeader>
          {/* Capability resolves with the session/profile rows; the portal's
              screens are lists, so hold the list geometry behind the header. */}
          <SkeletonList rows={3} lines={3} thumb={56} round label="Checking helper access" />
        </Screen>
      </>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!isVerifiedHelper) {
    return (
      <>
        <GlassHeader title={title} />
        <Screen beneathHeader>
          <ErrorState
            title="Helper Portal unavailable"
            message="This area is for verified helpers."
            retryTitle="Back to profile"
            onRetry={() => router.replace('/(requester)/profile')}
          />
        </Screen>
      </>
    );
  }

  return <>{children}</>;
}
