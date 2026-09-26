import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { DevProfileSwitcher } from '@/components/DevProfileSwitcher';
import { HeaderSettings } from '@/components/HeaderSettings';
import { HelperPortalGuard } from '@/components/HelperPortalGuard';
import { RedScreen } from '@/components/RedScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { SkeletonProfile } from '@/components/ui/LoadingBlocks';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing, touchTargets, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useHelperAvailability } from '@/hooks/useHelperAvailability';
import { useHelperStats } from '@/hooks/useHelperStats';
import { formatMYR } from '@/lib/money';

/**
 * Destinations that exist. Every row here resolves to a real screen: the two
 * helper-scoped ones are in this folder, Personal information is the account
 * form, and Help & Support is the same help centre the requester side uses.
 * Nothing points at a screen that has not been built.
 */
const MENU_ROWS = [
  { icon: 'payments', title: 'Earnings & Payouts', href: '/(requester)/helper-portal/earnings' },
  { icon: 'history', title: 'Delivery History', href: '/(requester)/helper-portal/deliveries' },
  { icon: 'person-outline', title: 'Personal Information', href: '/(requester)/edit-profile' },
  { icon: 'help-outline', title: 'Help & Support', href: '/(requester)/help' },
  { icon: 'info-outline', title: 'About Helper', href: '/(requester)/helper-portal/about' },
] as const;

/** One figure in the stats band: icon, value, label, equal share of the width. */
function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View
      style={styles.stat}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}>
      <MaterialIcons name={icon as never} size={20} color={colors.primary} />
      <Text variant="subtitle" style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" color="secondary">
        {label}
      </Text>
    </View>
  );
}

/**
 * Helper Portal profile: the helper's working identity and their three figures.
 *
 * Not an account screen — sign-out and account settings stay on the main
 * Profile. Earnings are the delivery fee per settled order; COD cash collected
 * on delivery belongs to Send2U, and the copy says so.
 *
 * Deliveries, rating and earnings are the real records (terminal deliveries plus
 * the ratings left on them). A helper with no ratings sees a dash: absent data
 * is shown as absent rather than as a perfect score.
 */
export default function HelperPortalProfileScreen() {
  const { user, profile, isLoading } = useAuth();
  const { isAvailable, updating, error: availabilityError, setAvailable } = useHelperAvailability();
  const { stats, status: statsStatus, error: statsError, refresh: refreshStats } = useHelperStats();
  const [devOpen, setDevOpen] = useState(false);

  const displayName =
    profile?.fullName?.trim() ||
    profile?.displayName?.trim() ||
    user?.email?.split('@')[0] ||
    'Helper';

  const handleToggle = async (next: boolean): Promise<void> => {
    try {
      await setAvailable(next);
    } catch {
      // error already in hook, surfaced in the section copy
    }
  };

  return (
    <HelperPortalGuard title="Profile">
      <RedScreen
        title="Profile"
        centerTitle
        right={<HeaderSettings href="/(requester)/settings" color={colors.onPrimary} />}
        underTabs
        contentStyle={styles.content}>
        {isLoading && !profile ? (
          <SkeletonProfile rows={5} label="Loading your helper profile" />
        ) : (
          <>
            {/* Identity sits against the header/white transition with no
                container, so the row itself reads as the control. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Helper details for ${displayName}. Opens personal information.`}
              onPress={() => router.push('/(requester)/edit-profile')}
              style={({ pressed }) => [styles.identity, pressed && styles.pressed]}>
              <Avatar name={displayName} path={profile?.avatarPath} size={64} />
              <View style={styles.identityText}>
                <Text variant="subtitle" numberOfLines={2}>
                  {displayName}
                </Text>
                <Text variant="caption" color="secondary" numberOfLines={1}>
                  Helper Partner
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </Pressable>

            {statsStatus === 'error' ? (
              <ErrorState
                title="Could not load your figures"
                message={statsError ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={() => void refreshStats()}
              />
            ) : (
              <View style={styles.statsBand}>
                <Stat
                  icon="delivery-dining"
                  value={statsStatus === 'loading' ? '—' : String(stats.deliveries)}
                  label="deliveries"
                />
                <Stat
                  icon="star-outline"
                  value={
                    statsStatus === 'loading'
                      ? '—'
                      : stats.rating
                        ? stats.rating.average.toFixed(1)
                        : '—'
                  }
                  label="rating"
                />
                <Stat
                  icon="account-balance-wallet"
                  value={statsStatus === 'loading' ? '—' : formatMYR(stats.earningsCents)}
                  label="earned"
                />
              </View>
            )}

            <View style={styles.onlineSection}>
              <View style={styles.onlineText}>
                <View style={styles.onlineHeading}>
                  <View
                    style={[
                      styles.onlineDot,
                      { backgroundColor: isAvailable ? colors.success : colors.muted },
                    ]}
                  />
                  <Text variant="secondary" style={styles.onlineTitle}>
                    {isAvailable ? 'Online' : 'Offline'}
                  </Text>
                </View>
                <Text variant="caption" color="secondary">
                  {availabilityError
                    ? availabilityError
                    : updating
                      ? 'Updating…'
                      : isAvailable
                        ? 'You are receiving delivery requests.'
                        : 'You are not receiving delivery requests.'}
                </Text>
              </View>
              <Switch
                value={isAvailable}
                onValueChange={(next) => void handleToggle(next)}
                disabled={updating}
                trackColor={{ false: colors.disabledBackground, true: colors.success }}
                thumbColor={colors.onPrimary}
                accessibilityLabel="Availability for delivery jobs"
              />
            </View>

            <View>
              {MENU_ROWS.map((row, index) => (
                <View
                  key={row.href}
                  style={index < MENU_ROWS.length - 1 ? styles.divider : undefined}>
                  <ListRow
                    icon={row.icon}
                    title={row.title}
                    accessibilityLabel={row.title}
                    onPress={() => router.push(row.href)}
                  />
                </View>
              ))}
            </View>

            <View style={styles.devSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Dev section. ${devOpen ? 'Hide' : 'Show'} test accounts.`}
                accessibilityState={{ expanded: devOpen }}
                onPress={() => setDevOpen((open) => !open)}
                style={({ pressed }) => [styles.devRow, pressed && styles.pressed]}>
                <View style={styles.devIcon}>
                  <MaterialIcons name="code" size={20} color={colors.secondary} />
                </View>
                <View style={styles.devText}>
                  <Text variant="secondary" style={styles.devTitle}>
                    Dev Section
                  </Text>
                  <Text variant="caption" color="secondary">
                    Test accounts and switching. Not part of a delivery.
                  </Text>
                </View>
                <MaterialIcons
                  name={devOpen ? 'keyboard-arrow-up' : 'chevron-right'}
                  size={24}
                  color={colors.muted}
                />
              </Pressable>
              {devOpen ? <DevProfileSwitcher /> : null}
            </View>
          </>
        )}
      </RedScreen>
    </HelperPortalGuard>
  );
}

const styles = StyleSheet.create({
  // No top padding: the identity row starts at the sheet's first pixel, which
  // puts it directly against the red-to-white transition.
  content: { paddingTop: 0, gap: spacing.xxl },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTargets.listRow,
    paddingVertical: spacing.lg,
  },
  identityText: { flex: 1, gap: spacing.xs },
  pressed: { opacity: 0.7 },

  statsBand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  statValue: { ...typography.subtitle, color: colors.text },

  onlineSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.successSoft,
  },
  onlineText: { flex: 1, gap: spacing.xs },
  onlineHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  onlineDot: { width: 8, height: 8, borderRadius: radii.full },
  onlineTitle: { fontWeight: '600', color: colors.text },

  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },

  devSection: {
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTargets.listRow,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  devIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  devText: { flex: 1, gap: spacing.xs },
  devTitle: { fontWeight: '600', color: colors.text },
});
