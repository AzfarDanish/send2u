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

let sessionProfileCache: DevProfile[] | null = null;

export function DevProfileSwitcher() {
  const { user, profile, devAuthEnabled } = useAuth();
  const [profiles, setProfiles] = useState<DevProfile[]>(() => sessionProfileCache ?? []);
  const [loading, setLoading] = useState(() => sessionProfileCache === null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [roleTab, setRoleTab] = useState<UserRole | null>(null);

  const load = useCallback(async (force = false) => {
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

  const [seenUserId, setSeenUserId] = useState(user?.id);
  if (seenUserId !== user?.id) {
    setSeenUserId(user?.id);
    setRoleTab(null);
  }

  const activeTab: UserRole =
    roleTab ?? (profile?.role === 'helper' ? 'helper' : profile?.role === 'vendor' ? 'vendor' : 'requester');
  const requesters = profiles.filter((item) => item.role === 'requester');
  const helpers = profiles.filter((item) => item.role === 'helper');
  const vendors = profiles.filter((item) => item.role === 'vendor');
  const visible = activeTab === 'helper' ? helpers : activeTab === 'vendor' ? vendors : requesters;

  const handleSwitch = useCallback(
    async (target: DevProfile) => {
      if (switchingId || target.id === user?.id) return;
      setSwitchingId(target.id);
      try {
        await switchDevProfile(target.id);
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

  return (
    <Card style={styles.devCard}>
      <View style={styles.devHeader}>
        <Badge label="Development" tone="error" />
      </View>
      
      {loading ? (
        <View style={styles.centerRow}>
          <ActivityIndicator color={colors.error} />
        </View>
      ) : loadError ? (
        <ErrorState title="Test accounts unavailable" message={loadError} retryTitle="Retry" onRetry={() => void load(true)} />
      ) : profiles.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text color="secondary">No test accounts visible.</Text>
          <Button title="Refresh list" variant="secondary" onPress={() => void load(true)} />
        </View>
      ) : (
        <View style={styles.list}>
          <View style={styles.tabs} accessibilityRole="tablist">
            {([
              { key: 'requester' as UserRole, count: requesters.length },
              { key: 'helper' as UserRole, count: helpers.length },
              ...(vendors.length > 0 ? [{ key: 'vendor' as UserRole, count: vendors.length }] : []),
            ] as const).map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  disabled={switchingId !== null}
                  onPress={() => setRoleTab(tab.key)}
                  style={[styles.tab, selected && styles.tabSelected]}>
                  <Text variant="caption" style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
                    {tab.count} {tab.key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          
          {visible.map((item) => {
            const isCurrent = item.id === user?.id;
            const isSwitching = switchingId === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isCurrent, busy: isSwitching, disabled: isCurrent }}
                disabled={isCurrent}
                onPress={() => void handleSwitch(item)}
                style={({ pressed }) => [
                  styles.row,
                  isCurrent && styles.rowCurrent,
                  pressed && !isCurrent && styles.rowPressed,
                ]}>
                <View style={[styles.iconWrap, isCurrent && styles.iconWrapCurrent]}>
                  <MaterialIcons
                    name={item.role === 'helper' ? 'delivery-dining' : item.role === 'vendor' ? 'storefront' : 'shopping-bag'}
                    size={20}
                    color={isCurrent ? colors.onPrimary : colors.error}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text variant="secondary" style={styles.rowTitle} numberOfLines={1}>
                    {item.displayName ?? `Test ${item.role}`}
                  </Text>
                  <Text variant="caption" color="secondary" numberOfLines={1}>
                    ID {item.id.slice(0, 8)}…
                  </Text>
                </View>
                {isSwitching ? (
                  <ActivityIndicator color={colors.error} />
                ) : (
                  <View style={styles.badges}>
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
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  devCard: {
    borderColor: colors.error,
    borderWidth: 1.5,
    backgroundColor: colors.errorSoft,
  },
  devHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerRow: { alignItems: 'center', paddingVertical: spacing.md },
  emptyBlock: { gap: spacing.sm, alignItems: 'center' },
  list: { gap: spacing.sm },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.surface,
  },
  tabSelected: { backgroundColor: colors.error },
  tabLabel: { color: colors.error },
  tabLabelSelected: { color: colors.onPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.sm,
    minHeight: 56,
  },
  rowCurrent: { borderWidth: 2 },
  rowPressed: { opacity: 0.7 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCurrent: { backgroundColor: colors.error },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontWeight: '600', color: colors.text },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
