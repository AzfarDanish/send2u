import { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useVendorMenu } from '@/hooks/useVendorMenu';
import { formatMYR, formatPriceInput, parsePriceToCents } from '@/lib/money';
import type { MenuItem } from '@/types/domain';

/**
 * Vendor Menu tab: own menu items only. Add, edit, toggle availability,
 * and delete. Every write round-trips through the vendor RPCs (which
 * re-read the row afterwards), so this list always shows what requesters
 * see. Past orders keep their snapshots regardless of edits here.
 */
export default function VendorMenuScreen() {
  const { items, status, error, refreshing, retry, refresh, saveItem, removeItem, setAvailability } =
    useVendorMenu();
  const [formKey, setFormKey] = useState<'closed' | string>('closed');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const busy = workingId !== null;

  const handleToggle = async (item: MenuItem, next: boolean) => {
    if (busy) return;
    setWorkingId(item.id);
    setRowError(null);
    try {
      await setAvailability(item.id, next);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Could not update availability.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleDelete = (item: MenuItem) => {
    if (busy) return;
    Alert.alert(
      'Delete item?',
      `"${item.name}" leaves the menu. Past orders keep their records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setWorkingId(item.id);
            setRowError(null);
            void removeItem(item.id)
              .catch((err: unknown) => {
                setRowError(err instanceof Error ? err.message : 'Could not delete the item.');
              })
              .finally(() => {
                setWorkingId(null);
              });
          },
        },
      ],
    );
  };

  const editingItem = formKey === 'closed' ? null : (items.find((item) => item.id === formKey) ?? null);
  const showingForm = formKey !== 'closed';

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
      }>
      <SectionHeader eyebrow="Menu" title="Your menu" />
      {status === 'loading' ? (
        <Card style={styles.stateCard}>
          <LoadingState message="Loading your menu…" />
        </Card>
      ) : null}
      {status === 'error' ? (
        <Card style={styles.stateCard}>
          <ErrorState
            title="Couldn't load your menu"
            message={error ?? 'Check your connection and try again.'}
            retryTitle="Try again"
            onRetry={retry}
          />
        </Card>
      ) : null}
      {status === 'empty' && !showingForm ? (
        <EmptyState
          icon="restaurant-menu"
          title="No items yet"
          message="Add your first item below."
        />
      ) : null}
      {status === 'ready' || status === 'empty'
        ? items.map((item) => (
            <Card key={item.id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={styles.itemText}>
                  <Text variant="secondary" style={styles.itemName}>
                    {item.name}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {formatMYR(item.priceCents)} · {item.isAvailable ? 'Available' : 'Unavailable'}
                  </Text>
                </View>
                {workingId === item.id ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary}
                    accessibilityLabel="Updating availability…"
                  />
                ) : null}
                <Switch
                  value={item.isAvailable}
                  onValueChange={(next) => void handleToggle(item, next)}
                  disabled={busy}
                  trackColor={{ false: colors.disabledBackground, true: colors.primarySoft }}
                  thumbColor={item.isAvailable ? colors.primary : colors.muted}
                  accessibilityLabel={`${item.name} available`}
                />
              </View>
              <View style={styles.itemActions}>
                <Button
                  title="Edit"
                  variant="secondary"
                  onPress={() => setFormKey(item.id)}
                  disabled={busy}
                />
                <Button
                  title={workingId === item.id ? 'Working…' : 'Delete'}
                  variant="danger"
                  onPress={() => handleDelete(item)}
                  disabled={busy}
                  loading={workingId === item.id}
                />
              </View>
            </Card>
          ))
        : null}
      {rowError ? (
        <ErrorState title="Menu update failed" message={rowError} retryTitle="Dismiss" onRetry={() => setRowError(null)} />
      ) : null}
      {showingForm ? (
        <ItemForm
          key={formKey === 'new' ? 'new' : editingItem?.id ?? 'new'}
          initial={editingItem}
          onClose={() => setFormKey('closed')}
          saveItem={saveItem}
        />
      ) : (
        <Button title="Add item" onPress={() => setFormKey('new')} disabled={busy} />
      )}
    </Screen>
  );
}

function ItemForm({
  initial,
  onClose,
  saveItem,
}: {
  initial: MenuItem | null;
  onClose: () => void;
  saveItem: (itemId: string | null, input: { name: string; description: string | null; priceCents: number; isAvailable: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial ? formatPriceInput(initial.priceCents) : '');
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const priceCents = parsePriceToCents(price);
      await saveItem(initial?.id ?? null, {
        name,
        description: description.trim() ? description : null,
        priceCents,
        isAvailable,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Text variant="subtitle">{initial ? 'Edit item' : 'New item'}</Text>
      <Text variant="caption" color="secondary">
        Name
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Nasi lemak"
        placeholderTextColor={colors.muted}
        maxLength={120}
        editable={!saving}
        style={styles.input}
        accessibilityLabel="Item name"
      />
      <Text variant="caption" color="secondary">
        Description (optional)
      </Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="What is in it"
        placeholderTextColor={colors.muted}
        maxLength={500}
        multiline
        editable={!saving}
        style={[styles.input, styles.multiline]}
        accessibilityLabel="Item description"
      />
      <Text variant="caption" color="secondary">
        Price (RM)
      </Text>
      <TextInput
        value={price}
        onChangeText={setPrice}
        placeholder="e.g. 6.50"
        placeholderTextColor={colors.muted}
        keyboardType="decimal-pad"
        editable={!saving}
        style={styles.input}
        accessibilityLabel="Item price in Ringgit"
      />
      <View style={styles.availabilityRow}>
        <Text variant="secondary" style={styles.availabilityLabel}>
          Available for order
        </Text>
        <Switch
          value={isAvailable}
          onValueChange={setIsAvailable}
          disabled={saving}
          trackColor={{ false: colors.disabledBackground, true: colors.primarySoft }}
          thumbColor={isAvailable ? colors.primary : colors.muted}
          accessibilityLabel="Item available for order"
        />
      </View>
      {formError ? (
        <Text variant="caption" color="error">
          {formError}
        </Text>
      ) : null}
      <Button
        title={saving ? 'Saving…' : initial ? 'Save changes' : 'Add item'}
        onPress={() => void handleSave()}
        disabled={saving}
        loading={saving}
      />
      <Button title="Cancel" variant="secondary" onPress={onClose} disabled={saving} />
    </Card>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  itemCard: { gap: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemText: { flex: 1, gap: spacing.xs },
  itemName: { fontWeight: '600', color: colors.text },
  itemActions: { flexDirection: 'row', gap: spacing.sm },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  availabilityLabel: { flex: 1 },
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
