import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { listDevProfiles, switchDevProfile, type DevProfile } from '@/services/devProfiles';
import type { UserRole } from '@/types/domain';

/**
 * Session-level cache of the dev roster (see `load`): the list changes only
 * via out-of-band seeding, so refetching on every Profile visit is pure
 * waste. Cleared only by explicit refresh / post-switch reload (force=true).
 */
let sessionProfileCache: DevProfile[] | null = null;

/**
 * Development-only test-account switcher, rendered inside the Profile page.
 *
 * The section keeps one restrained dev marker (red eyebrow) so it can
 * never be mistaken for a production setting — everything else follows
 * the workspace language: flat rows, hairline dividers, underline tabs,
 * no cards, no badges. The list is sourced from the database on every
 * load — never hard-coded — so any number of seeded test accounts
 * renders. Switching assumes an existing account's session; it creates
 * nothing and mutates nothing (no new users, no profile writes, no role
 * changes).
 */
export function DevProfileSwitcher() {
  const { user, profile, devAuthEnabled } = useAuth();
  // The session roster changes only via out-of-band seeding, so mounts
  // serve it straight from the cache via initial state (no setState in an
  // effect); only a mount that finds the cache empty fetches below.
  const [profiles, setProfiles] = useState<DevProfile[]>(() => sessionProfileCache ?? []);
  const [loading, setLoading] = useState(() => sessionProfileCache === null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  // Explicit tab choice; null follows the current account's role so the
  // Current marker is visible right after entering or switching accounts.
  const [roleTab, setRoleTab] = useState<UserRole | null>(null);

  const load = useCallback(async (force = false) => {
    // The dev roster changes only via out-of-band seeding — serve it from
    // the session cache and skip the RPC on every Profile visit. Refresh
    // buttons and post-switch reloads pass force=true.
    if (!force && sessionProfileCache) {
      setProfiles(sessionProfileCache);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const next = await listDevProfiles();
      sessionProfileCache = next;
      setProfiles(next);
    } catch (error) {
      setProfiles([]);
      setLoadError(error instanceof Error ? error.message : 'Could not load test accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!devAuthEnabled || sessionProfileCache) return;
    let cancelled = false;
    (async () => {
      try {
        const next = await listDevProfiles();
        sessionProfileCache = next;
        if (!cancelled) {
          setProfiles(next);
          setLoadError(null);
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setProfiles([]);
          setLoadError(error instanceof Error ? error.message : 'Could not load test accounts.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [devAuthEnabled]);

  // Follow account switches: reset an explicit tab choice during render so
  // the new current account's tab (and its Current marker) shows
  // immediately (the React-endorsed alternative to setState-in-effect).
  const [seenUserId, setSeenUserId] = useState(user?.id);
  if (seenUserId !== user?.id) {
    setSeenUserId(user?.id);
    setRoleTab(null);
  }

  const activeTab: UserRole =
    roleTab ?? (profile?.role === 'vendor' ? 'vendor' : 'requester');
  const requesters = profiles.filter((item) => item.role === 'requester' && !item.isVerifiedHelper);
  // Helpers = verified requesters (plus any legacy role='helper' rows).
  const helpers = profiles.filter((item) => item.role === 'helper' || item.isVerifiedHelper);
  const vendors = profiles.filter((item) => item.role === 'vendor');
  const visible = activeTab === 'helper' ? helpers : activeTab === 'vendor' ? vendors : requesters;

  const handleSwitch = useCallback(
    async (target: DevProfile) => {
      if (switchingId || target.id === user?.id) return;
      setSwitchingId(target.id);
      try {
        await switchDevProfile(target.id);
        // The new session arrives via the auth-state listener, which reloads
        // the profile and re-routes by role. Force-refresh the list so the
        // "current" marker follows the switch.
        await load(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not switch accounts.';
        Alert.alert('Could not switch test account', message);
      } finally {
        setSwitchingId(null);
      }
    },
    [switchingId, user?.id, load],
  );

  if (!devAuthEnabled) return null;

  const roleLabel = (role: DevProfile['role']) =>
    role === 'requester' ? 'Requester' : role === 'helper' ? 'Helper' : role === 'vendor' ? 'Vendor' : role;

  return (
    <View style={styles.section}>
      <Text variant="eyebrow" color="error">
        {`Development${profiles.length > 0 && !loading ? ` · ${profiles.length} test account${profiles.length === 1 ? '' : 's'}` : ''}`.toUpperCase()}
      </Text>
      <Text variant="subtitle">Switch test account</Text>
      <Text variant="caption" color="secondary">
        Dev-only test accounts.
      </Text>

      {loading ? (
        <View style={styles.centerRow}>
          <ActivityIndicator color={colors.primary} />
          <Text color="secondary">Loading test accounts…</Text>
        </View>
      ) : loadError ? (
        <ErrorState title="Test accounts unavailable" message={loadError} retryTitle="Retry" onRetry={() => void load(true)} />
      ) : profiles.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text color="secondary">
            No test accounts visible. Seed them out-of-band, then refresh.
          </Text>
            <Button title="Refresh list" variant="secondary" onPress={() => void load(true)} />
        </View>
      ) : (
        <View style={styles.list}>
          <View style={styles.tabs} accessibilityRole="tablist">
            {(
              [
                { key: 'requester', label: `Requesters · ${requesters.length}` },
                { key: 'helper', label: `Helpers · ${helpers.length}` },
                ...(vendors.length > 0
                  ? [{ key: 'vendor', label: `Vendors · ${vendors.length}` } as const]
                  : []),
              ] as const
            ).map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${tab.label} test accounts`}
                  disabled={switchingId !== null}
                  onPress={() => setRoleTab(tab.key)}
                  style={[styles.tab, selected && styles.tabSelected]}>
                  <Text
                    variant="secondary"
                    style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {visible.length === 0 ? (
            <Text color="secondary">
              No {activeTab} test accounts.
            </Text>
          ) : null}
          {visible.map((item, index) => {
            const isCurrent = item.id === user?.id;
            const isSwitching = switchingId === item.id;
            const disabled = switchingId !== null;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent, busy: isSwitching, disabled: disabled || isCurrent }}
                accessibilityLabel={`Switch to ${item.displayName ?? item.id}`}
                disabled={disabled || isCurrent}
                onPress={() => void handleSwitch(item)}
                style={({ pressed }) => [
                  styles.row,
                  index < visible.length - 1 && styles.rowDivider,
                  pressed && !disabled && !isCurrent && styles.rowPressed,
                ]}>
                <View style={styles.iconWrap}>
                    <MaterialIcons
                      name={
                        item.role === 'helper'
                          ? 'delivery-dining'
                          : item.role === 'vendor'
                            ? 'storefront'
                            : 'shopping-bag'
                      }
                      size={22}
                      color={colors.secondary}
                    />
                </View>
                <View style={styles.rowText}>
                  <Text variant="secondary" style={styles.rowTitle}>
                    {item.displayName ?? `Test ${roleLabel(item.role)} ${item.id.slice(0, 8)}`}
                  </Text>
                  <Text variant="caption" color="secondary">
                    ID {item.id.slice(0, 8)}…
                    {item.createdAt ? ` · joined ${new Date(item.createdAt).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                {isSwitching ? (
                  <ActivityIndicator color={colors.primary} />
                ) : isCurrent ? (
                  <Text variant="caption" color="secondary">
                    Current
                  </Text>
                ) : (
                  <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                )}
              </Pressable>
            );
          })}
          <Button
            title="Refresh list"
            variant="tertiary"
            onPress={() => void load(true)}
            disabled={switchingId !== null}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  emptyBlock: { gap: spacing.sm },
  list: { gap: spacing.sm },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabSelected: { borderBottomColor: colors.primary },
  tabLabel: { fontWeight: '600', color: colors.secondary },
  tabLabelSelected: { color: colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 64,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowPressed: { opacity: 0.7 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontWeight: '600', color: colors.text },
});
