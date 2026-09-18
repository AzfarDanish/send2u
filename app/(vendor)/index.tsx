import { useState } from 'react';
import { RefreshControl, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonList } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useMyVendor } from '@/hooks/useMyVendor';
import type { Vendor } from '@/types/domain';

/**
 * Vendor Stall tab: own stall information and the day-to-day open switch.
 * Orders live on the Orders tab — this screen manages the stall only.
 * `is_active` is admin-controlled (hidden stall notice); vendors own
 * `is_open` (day-to-day) and the editable details.
 */
export default function VendorStallScreen() {
  const { vendor, status, error, saving, refreshing, retry, refresh, save, patchVendor } = useMyVendor();
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const busy = saving || toggling;

  const handleToggleOpen = async (next: boolean) => {
    if (!vendor || busy) return;
    const previous = vendor.isOpen;
    // Optimistic flip: the switch reflects the tap instantly; the write
    // reconciles afterwards and rolls back here on failure.
    patchVendor({ isOpen: next });
    setToggling(true);
    setActionError(null);
    try {
      await save({
        name: vendor.name,
        description: vendor.description,
        locationHint: vendor.locationHint,
        operatingHours: vendor.operatingHours,
        isOpen: next,
      });
    } catch (err) {
      patchVendor({ isOpen: previous });
      setActionError(err instanceof Error ? err.message : 'Could not update the open status.');
    } finally {
      setToggling(false);
    }
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }>
      <SectionHeader eyebrow="Stall" title="Your stall" />
      {status === 'loading' ? (
        // Two cards, mirroring the loaded screen: identity + open badge row,
        // then the description block.
        <>
          <Card>
            <SkeletonList rows={1} lines={2} thumb={0} trailing label="Loading your stall" />
          </Card>
          <Card>
            <SkeletonBlock lines={3} label="Loading your stall" />
          </Card>
        </>
      ) : null}
      {status === 'error' ? (
        <Card style={styles.stateCard}>
          {error?.includes('No stall is linked') ? (
            <EmptyState
              icon="storefront"
              title="No stall linked"
              message="This account is not linked to a stall yet. Ask your administrator to link one, then pull to refresh."
            />
          ) : (
            <ErrorState
              title="Couldn't load your stall"
              message={error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={retry}
            />
          )}
        </Card>
      ) : null}
      {status === 'ready' && vendor ? (
        <>
          <Card>
            <View style={styles.statusRow}>
              <View style={styles.statusText}>
                <Text variant="subtitle">{vendor.name}</Text>
                <Text variant="caption" color="secondary">
                  {vendor.isOpen ? 'Open for orders' : 'Closed — hidden from ordering'}
                </Text>
              </View>
              <Badge label={vendor.isOpen ? 'Open' : 'Closed'} tone={vendor.isOpen ? 'success' : 'warning'} />
            </View>
            <View style={styles.toggleRow}>
              <Text variant="secondary" style={styles.toggleLabel}>
                Stall open
              </Text>
              <Switch
                value={vendor.isOpen}
                onValueChange={(next) => void handleToggleOpen(next)}
                disabled={busy}
                trackColor={{ false: colors.disabledBackground, true: colors.primarySoft }}
                thumbColor={vendor.isOpen ? colors.primary : colors.muted}
                accessibilityLabel="Stall open for orders"
              />
            </View>
            {!vendor.isActive ? (
              <Text variant="caption" color="error">
                Hidden by your administrator — requesters cannot see this stall regardless of the switch above.
              </Text>
            ) : null}
          </Card>

          {editing ? (
            <StallForm
              initial={vendor}
              saving={saving}
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
              onError={setActionError}
              save={save}
            />
          ) : (
            <Card>
              {vendor.description ? <Text color="secondary">{vendor.description}</Text> : null}
              {vendor.locationHint ? (
                <Text variant="caption" color="secondary">
                  {vendor.locationHint}
                </Text>
              ) : null}
              {vendor.operatingHours ? (
                <Text variant="caption" color="secondary">
                  {vendor.operatingHours}
                </Text>
              ) : null}
              <Button title="Edit stall details" variant="secondary" onPress={() => setEditing(true)} disabled={busy} />
            </Card>
          )}
          {actionError ? (
            <ErrorState title="Could not save" message={actionError} retryTitle="Dismiss" onRetry={() => setActionError(null)} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function StallForm({
  initial,
  saving,
  onCancel,
  onSaved,
  onError,
  save,
}: {
  initial: Vendor;
  saving: boolean;
  onCancel: () => void;
  onSaved: () => void;
  onError: (message: string | null) => void;
  save: (input: {
    name: string;
    description: string | null;
    locationHint: string | null;
    operatingHours: string | null;
    isOpen: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? '');
  const [locationHint, setLocationHint] = useState(initial.locationHint ?? '');
  const [operatingHours, setOperatingHours] = useState(initial.operatingHours ?? '');

  const handleSave = async () => {
    if (saving) return;
    onError(null);
    try {
      await save({
        name,
        description: description.trim() ? description : null,
        locationHint: locationHint.trim() ? locationHint : null,
        operatingHours: operatingHours.trim() ? operatingHours : null,
        isOpen: initial.isOpen,
      });
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save your stall.');
    }
  };

  return (
    <Card>
      <Text variant="subtitle">Stall details</Text>
      <Text variant="caption" color="secondary">
        Name
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Stall name"
        placeholderTextColor={colors.muted}
        maxLength={120}
        editable={!saving}
        style={styles.input}
        accessibilityLabel="Stall name"
      />
      <Text variant="caption" color="secondary">
        Description (optional)
      </Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="What this stall serves"
        placeholderTextColor={colors.muted}
        maxLength={500}
        multiline
        editable={!saving}
        style={[styles.input, styles.multiline]}
        accessibilityLabel="Stall description"
      />
      <Text variant="caption" color="secondary">
        Location (optional)
      </Text>
      <TextInput
        value={locationHint}
        onChangeText={setLocationHint}
        placeholder="e.g. Block A food court"
        placeholderTextColor={colors.muted}
        maxLength={120}
        editable={!saving}
        style={styles.input}
        accessibilityLabel="Stall location"
      />
      <Text variant="caption" color="secondary">
        Operating hours (optional)
      </Text>
      <TextInput
        value={operatingHours}
        onChangeText={setOperatingHours}
        placeholder="e.g. Mon–Fri 9am–5pm"
        placeholderTextColor={colors.muted}
        maxLength={120}
        editable={!saving}
        style={styles.input}
        accessibilityLabel="Operating hours"
      />
      <Button
        title={saving ? 'Saving…' : 'Save changes'}
        onPress={() => void handleSave()}
        disabled={saving}
        loading={saving}
      />
      <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={saving} />
    </Card>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusText: { flex: 1, gap: spacing.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
});
