import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandHeader } from '@/components/BrandHeader';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonBlock } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { consumeFreshAuthEntry } from '@/lib/authEntry';
import { markOnboardingComplete, useOnboardingStatus } from '@/lib/onboarding';

const HIGHLIGHTS = [
  {
    icon: 'storefront' as const,
    title: 'Order in a minute',
    body: 'Browse a stall menu and choose a campus drop-off point.',
  },
  {
    icon: 'payments' as const,
    title: 'Online or cash',
    body: 'Send2U records the payment and the settlement for every request.',
  },
  {
    icon: 'delivery-dining' as const,
    title: 'Delivered by students',
    body: 'A nearby student helper collects your food and hands it over.',
  },
];

/**
 * App entry (`/`). Deliberately NOT a redirect: this route renders real
 * content and the user always chooses where to go next. A launch screen whose
 * only job is to bounce the user through a loading flash hides what the app
 * is, and makes a cold start or a deep link unpredictable.
 *
 * Routing the session still has to be right, so the states resolve here:
 * - account just created (walkthrough pending) → the onboarding slides open
 *   in place, and finish straight into the app
 * - signed in → one explicit "Continue" into the role's application
 * - signed in without a usable role → the account-recovery route
 * - signed out → sign-in / create account
 */
export default function WelcomeScreen() {
  const { user, role, isLoading } = useAuth();
  const onboarding = useOnboardingStatus(user?.id ?? null);
  // Read once on mount: true only when the user arrived here by completing an
  // explicit sign-in, which is the flow allowed to forward them straight in.
  const [enteredViaSignIn] = useState(() => consumeFreshAuthEntry());

  const destination: Href = role === 'vendor' ? '/(vendor)' : '/(requester)';

  const finishOnboarding = useCallback(() => {
    const userId = user?.id;
    if (userId) void markOnboardingComplete(userId);
    // Replace, not push: the walkthrough is a one-time gate, so back should
    // never return to it.
    router.replace(destination);
  }, [destination, user?.id]);

  useEffect(() => {
    // A fresh sign-in means the user has already asked to be let in. The
    // walkthrough still wins the first time, and a cold start never forwards.
    if (!enteredViaSignIn) return;
    if (isLoading || !user || !role) return;
    if (onboarding !== 'done') return;
    router.replace(destination);
  }, [destination, enteredViaSignIn, isLoading, onboarding, role, user]);

  if (isLoading || onboarding === 'loading') {
    return (
      <Screen>
        <View accessibilityRole="progressbar" accessibilityLabel="Getting Send2U ready">
          <View style={styles.brandSkeleton}>
            <Skeleton width={64} height={64} radius={radii.xl} />
            <Skeleton width="45%" height={28} />
            <Skeleton width="70%" height={16} />
          </View>
          <SkeletonBlock lines={3} label="Getting Send2U ready" />
        </View>
      </Screen>
    );
  }

  // A freshly created account walks through the slides before it reaches the
  // app. Rendered here rather than pushed, so signup cannot race the routing.
  if (user && role && onboarding === 'pending') {
    return <OnboardingFlow onFinish={finishOnboarding} />;
  }

  return (
    <Screen>
      <BrandHeader tagline="Campus food delivery, fulfilled by students" />

      {user && !role ? (
        <>
          <Text variant="title">Finish setting up your account</Text>
          <Text color="secondary">
            This account has no usable role yet, so Send2U cannot route it into an application.
          </Text>
          <Card>
            <View style={styles.accountRow}>
              <MaterialIcons name="account-circle" size={22} color={colors.primary} />
              <Text variant="secondary" style={styles.accountText} numberOfLines={1}>
                {user.email ?? 'Signed in'}
              </Text>
            </View>
          </Card>
          <Button title="Complete account setup" onPress={() => router.push('/select-role')} />
        </>
      ) : null}

      {user && role ? (
        <>
          <Text variant="eyebrow" color="muted">
            SIGNED IN
          </Text>
          <Text variant="title">
            {role === 'vendor' ? 'Continue to your stall' : 'Continue to Send2U'}
          </Text>
          <Card>
            <View style={styles.accountRow}>
              <MaterialIcons name="account-circle" size={22} color={colors.primary} />
              <Text variant="secondary" style={styles.accountText} numberOfLines={1}>
                {user.email ?? 'Signed in'}
              </Text>
            </View>
          </Card>
          <Button title="Continue to Send2U" onPress={() => router.replace(destination)} />
        </>
      ) : null}

      {!user ? (
        <>
          <Text variant="eyebrow" color="primary">
            WELCOME
          </Text>
          <Text variant="title">Food from campus stalls, delivered by students.</Text>
          <Text color="secondary">
            Pick a stall, choose Online Payment or Cash on Delivery, and Send2U manages the request
            from the stall to your drop-off point.
          </Text>

          {HIGHLIGHTS.map((row) => (
            <Card key={row.title}>
              <View style={styles.highlightRow}>
                <View style={styles.highlightIcon}>
                  <MaterialIcons name={row.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.highlightText}>
                  <Text variant="secondary" style={styles.highlightTitle}>
                    {row.title}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {row.body}
                  </Text>
                </View>
              </View>
            </Card>
          ))}

          <Button title="Sign in" onPress={() => router.push('/(auth)/sign-in')} />
          <Button
            title="Create an account"
            variant="secondary"
            onPress={() => router.push({ pathname: '/(auth)/sign-in', params: { mode: 'sign-up' } })}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandSkeleton: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accountText: { flex: 1, fontWeight: '600', color: colors.text },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  highlightIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: { flex: 1, gap: spacing.xs },
  highlightTitle: { fontWeight: '600', color: colors.text },
});
