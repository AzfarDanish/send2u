import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
 * The whole section carries a red visual identity (red border + tinted red
 * surface + error badge) so it can never be mistaken for a production
 * setting. The list is sourced from the database on every load — never
 * hard-coded — so any number of seeded test accounts renders. Switching
 * assumes an existing account's session; it creates nothing and mutates
 * nothing (no new users, no profile writes, no role changes).
 */
export function DevProfileSwitcher() {
  const { user, profile, devAuthEnabled } = useAuth();
  const [profiles, setProfiles] = useState<DevProfile[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (devAuthEnabled) {
      void load();
    }
  }, [devAuthEnabled, load]);

  // Follow account switches: reset an explicit tab choice so the new
  // current account's tab (and its Current marker) shows immediately.
  useEffect(() => {
    setRoleTab(null);
  }, [user?.id]);

  const activeTab: UserRole = roleTab ?? (profile?.role === 'helper' ? 'helper' : 'requester');
  const requesters = profiles.filter((item) => item.role === 'requester');
  const helpers = profiles.filter((item) => item.role === 'helper');
  const visible = activeTab === 'helper' ? helpers : requesters;

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
    role === 'requester' ? 'Requester' : role === 'helper' ? 'Helper' : role;

  return (
    <Card style={styles.devCard}>
      <View style={styles.devHeader}>
        <Badge label="Development" tone="error" />
        {profiles.length > 0 && !loading && (
          <Text variant="caption" color="error">
            {profiles.length} test account{profiles.length === 1 ? '' : 's'}
          </Text>
        )}
      </View>
      <Text variant="subtitle" color="error">
        Switch test account
      </Text>
      <Text variant="caption" color="error">
        Dev-only test accounts.
      </Text>

      {loading ? (
        <View style={styles.centerRow}>
          <ActivityIndicator color={colors.error} />
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
          {visible.map((item) => {
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
                  isCurrent && styles.rowCurrent,
                  pressed && !disabled && !isCurrent && styles.rowPressed,
                ]}>
                <View style={[styles.iconWrap, isCurrent && styles.iconWrapCurrent]}>
                  <MaterialIcons
                    name={item.role === 'helper' ? 'delivery-dining' : 'shopping-bag'}
                    size={22}
                    color={isCurrent ? colors.onPrimary : colors.error}
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
                  <ActivityIndicator color={colors.error} />
                ) : (
                  <View style={styles.badges}>
                    <Badge
                      label={roleLabel(item.role)}
                      tone={item.role === 'helper' ? 'success' : 'primary'}
                    />
                    {isCurrent ? (
                      <Badge label="Current" tone="error" />
                    ) : (
                      <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
                    )}
                  </View>
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
    </Card>
  );
}

const styles = StyleSheet.create({
  devCard: {
    borderColor: colors.error,
    borderWidth: 2,
    backgroundColor: colors.errorSoft,
  },
  devHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  emptyBlock: { gap: spacing.sm },
  list: { gap: spacing.sm },
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.error,
    backgroundColor: colors.surface,
  },
  tabSelected: { backgroundColor: colors.error },
  tabLabel: { fontWeight: '600', color: colors.error },
  tabLabelSelected: { color: colors.onPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.error,
    padding: spacing.md,
    minHeight: 64,
  },
  rowCurrent: { backgroundColor: colors.surface, borderWidth: 2.5 },
  rowPressed: { opacity: 0.7 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCurrent: { backgroundColor: colors.error },
  rowText: { flex: 1, gap: spacing.xs },
  rowTitle: { fontWeight: '600', color: colors.text },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
