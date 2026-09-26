import { StyleSheet, View } from 'react-native';

import { HeaderBack } from '@/components/HeaderBack';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { RedScreen } from '@/components/RedScreen';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

/**
 * About Helper: what the portal is, how the money works, and how to leave.
 *
 * Every line here is either a rule the backend enforces or copy already used
 * elsewhere in the app (the "how you earn" text moved off the profile screen).
 * There is no payout schedule, no tier system and no application flow to
 * describe: helper access is granted by the Send2U team out of band, and the
 * screens that would explain those things do not exist.
 */
export default function AboutHelperScreen() {
  const { profile, user, isVerifiedHelper } = useAuth();

  return (
    <HelperPortalGuard title="About Helper">
      <RedScreen
        title="About Helper"
        leading={
          <HeaderBack fallbackHref="/(requester)/helper-portal/profile" color={colors.onPrimary} />
        }>
        <View style={styles.card}>
          <Text variant="secondary" style={styles.cardTitle}>
            How you earn
          </Text>
          <Text color="secondary">
            You earn the delivery fee on every settled order. The food is covered by Send2U — never
            pay with your own money. Cash you collect on COD orders belongs to Send2U; confirm the
            collection in the delivery.
          </Text>
        </View>

        <View style={styles.card}>
          <Text variant="secondary" style={styles.cardTitle}>
            Your access
          </Text>
          <Text color="secondary">
            {isVerifiedHelper
              ? 'This account is a verified helper, so the portal is available.'
              : 'This account is not a verified helper, so the portal stays locked.'}
            {' '}Helper access is granted by the Send2U team; there is no self-serve application.
          </Text>
          {profile?.fullName || user?.email ? (
            <Text variant="caption" color="secondary">
              Delivering as {profile?.fullName?.trim() || user?.email}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text variant="secondary" style={styles.cardTitle}>
            Working limits
          </Text>
          <Text color="secondary">
            Three active deliveries at a time, and jobs only appear while you are online. Both
            limits are enforced by the database, not by this screen.
          </Text>
        </View>

        <View style={styles.card}>
          <Text variant="secondary" style={styles.cardTitle}>
            Leaving the portal
          </Text>
          <Text color="secondary">
            Leave on the Available Jobs screen returns you to the requester side of the app. Your
            helper record, delivery history and earnings stay attached to this account.
          </Text>
        </View>
      </RedScreen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  // No surface and no radius: content groups separate through whitespace and
  // typography (components/ui/Card), and a white block on the white sheet would
  // be an invisible container anyway.
  card: { gap: spacing.xs },
  cardTitle: { fontWeight: '600', color: colors.text },
});
