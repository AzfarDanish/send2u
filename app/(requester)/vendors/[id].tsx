import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

import { MenuItemRow } from '@/components/MenuItemRow';
import { PlaceholderImage } from '@/components/PlaceholderImage';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useMenu } from '@/hooks/useMenu';
import { formatMYR } from '@/lib/money';
import type { MenuItemWithVendor } from '@/types/domain';

/**
 * Requester vendor page: one stall's hero plus its own menu only.
 * Data comes from the same `useMenu()` sections as Home (no new queries);
 * item taps reuse the existing food-detail route with identical params.
 */
export default function VendorPageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sections, status, error, retry } = useMenu();
  const [seenId, setSeenId] = useState(id);
  if (seenId !== id) {
    setSeenId(id);
  }

  const openItem = useCallback((item: MenuItemWithVendor) => {
    router.push({ pathname: '/(requester)/menu/[id]', params: { id: item.id } });
  }, []);

  const { addItem, count, subtotalCents } = useCart();

  // Same rule as food detail: quick-add writes one unit to the local cart
  // only when the item is available; unavailable items stay disabled.
  const quickAdd = useCallback(
    (item: MenuItemWithVendor) => {
      if (!item.isAvailable) return;
      addItem(item, 1);
    },
    [addItem],
  );

  const section =
    typeof id === 'string' ? (sections.find((s) => s.vendor.id === id) ?? null) : null;

  if (status === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: 'Vendor' }} />
        <Screen>
          <LoadingState message="Loading vendor…" />
        </Screen>
      </>
    );
  }

  if (status === 'error') {
    return (
      <>
        <Stack.Screen options={{ title: 'Vendor' }} />
        <Screen>
          <Card style={styles.stateCard}>
            <ErrorState
              title="Couldn't load the vendor"
              message={error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={retry}
            />
          </Card>
        </Screen>
      </>
    );
  }

  if (!section) {
    return (
      <>
        <Stack.Screen options={{ title: 'Vendor' }} />
        <Screen>
          <ErrorState
            title="Vendor not found"
            message="This stall isn't available right now. Pick another vendor."
            retryTitle="Back to Home"
            onRetry={() => router.back()}
          />
        </Screen>
      </>
    );
  }

  const { vendor, items } = section;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen contentStyle={styles.noTopPad}>
        <View style={styles.heroPanel}>
          <PlaceholderImage style={styles.heroBackground} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.65)']}
            style={styles.heroShade}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            hitSlop={8}>
            <MaterialIcons name="chevron-left" size={26} color={colors.primary} />
          </Pressable>
          <View style={styles.heroContent}>
            <View style={styles.heroTitleRow}>
              <Text variant="title" style={styles.heroName}>
                {vendor.name}
              </Text>
              <Badge label={vendor.isOpen ? 'Open' : 'Closed'} tone={vendor.isOpen ? 'success' : 'warning'} />
            </View>
            {vendor.locationHint ? (
              <View style={styles.metaRow}>
                <MaterialIcons name="place" size={18} color={colors.onPrimary} />
                <Text variant="caption" style={styles.heroText}>
                  {vendor.locationHint}
                </Text>
              </View>
            ) : null}
            {vendor.operatingHours ? (
              <View style={styles.metaRow}>
                <MaterialIcons name="schedule" size={18} color={colors.onPrimary} />
                <Text variant="caption" style={styles.heroText}>
                  {vendor.operatingHours}
                </Text>
              </View>
            ) : null}
            {vendor.description ? (
              <Text color="secondary" style={styles.heroText}>
                {vendor.description}
              </Text>
            ) : null}
            {!vendor.isOpen ? (
              <Text variant="caption" style={styles.heroText}>
                This stall is currently closed. You can still browse the menu below.
              </Text>
            ) : null}
          </View>
        </View>

        {count > 0 ? (
          <Card>
            <ListRow
              icon="shopping-cart"
              title={`Cart · ${count} item${count === 1 ? '' : 's'}`}
              subtitle={formatMYR(subtotalCents)}
              onPress={() => router.push('/(requester)/create')}
            />
          </Card>
        ) : null}

        <SectionHeader
          title="Menu"
          badge={items.length > 0 ? `${items.length} item${items.length === 1 ? '' : 's'}` : undefined}
        />
        {items.length === 0 ? (
          <EmptyState
            icon="restaurant-menu"
            title="No items yet"
            message="This stall hasn't listed any food. Check back later."
          />
        ) : (
          <Card style={styles.itemsCard}>
            {items.map((item) => (
              <MenuItemRow
                key={item.id}
                item={item}
                onPress={openItem}
                thumbnail
                onAdd={quickAdd}
              />
            ))}
          </Card>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  noTopPad: { paddingTop: 0 },
  heroPanel: {
    minHeight: 300,
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceSecondary,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    marginHorizontal: -spacing.xl,
    overflow: 'hidden',
  },
  heroBackground: { ...StyleSheet.absoluteFill },
  heroShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 210,
  },
  backButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 1,
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  heroContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
  },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroName: { flex: 1, color: colors.onPrimary },
  heroText: { color: colors.onPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemsCard: { gap: 0 },
});
