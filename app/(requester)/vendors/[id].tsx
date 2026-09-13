import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

import { MenuItemRow } from '@/components/MenuItemRow';
import { CartFab } from '@/components/CartFab';
import { PlaceholderImage } from '@/components/PlaceholderImage';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useMenu } from '@/hooks/useMenu';
import type { MenuItemWithVendor } from '@/types/domain';

/**
 * Client-side faceting only: the backend has no category column, so the
 * filter bar groups this vendor's real items by drink-name hints
 * (teh/kopi/milo/juice/…). Items, prices, and availability are untouched —
 * only which rows render changes. The bar appears only when it can
 * actually filter (more than one group present).
 */
const DRINK_HINTS = [
  'teh', 'kopi', 'milo', 'nescafe', 'juice', 'jus', 'sirap', 'bandung',
  'latte', 'cappuccino', 'mocha', 'tea', 'coffee', 'susu', 'soya',
  'cendol', 'lemon', 'limau', 'cola', 'soda', 'drink', 'minuman',
];

function menuCategory(item: MenuItemWithVendor): string {
  const haystack = `${item.name} ${item.description ?? ''}`.toLowerCase();
  return DRINK_HINTS.some((hint) => haystack.includes(hint)) ? 'Drinks' : 'Food';
}

/**
 * Requester vendor page: one stall's hero plus its own menu only.
 * Data comes from the same `useMenu()` sections as Home (no new queries);
 * item taps reuse the existing food-detail route with identical params.
 */
export default function VendorPageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sections, status, error, retry } = useMenu();
  const [seenId, setSeenId] = useState(id);
  const [category, setCategory] = useState('All');
  if (seenId !== id) {
    setSeenId(id);
    setCategory('All');
  }

  const openItem = useCallback((item: MenuItemWithVendor) => {
    router.push({ pathname: '/(requester)/menu/[id]', params: { id: item.id } });
  }, []);

  const { addItem } = useCart();

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

  // Unconditional (above all early returns): category faceting over
  // whatever items are currently loaded.
  const buckets = useMemo(() => {
    const seen: string[] = [];
    for (const item of section?.items ?? []) {
      const bucket = menuCategory(item);
      if (!seen.includes(bucket)) seen.push(bucket);
    }
    return seen;
  }, [section]);
  const categories = useMemo(() => ['All', ...buckets], [buckets]);
  const showBar = buckets.length > 1;
  const visibleItems = useMemo(() => {
    const list = section?.items ?? [];
    return category === 'All' ? list : list.filter((item) => menuCategory(item) === category);
  }, [section, category]);

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
            onRetry={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(requester)');
            }}
          />
        </Screen>
      </>
    );
  }

  const { vendor, items } = section;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        contentStyle={styles.noTopPad}
        stickyHeaderIndices={showBar ? [1] : undefined}>
        <View style={styles.heroPanel}>
          <PlaceholderImage style={styles.heroBackground} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.65)']}
            style={styles.heroShade}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            onPress={() => {
              // Vendor pages open from Home; a history-less entry (deep
              // link) falls back there explicitly instead of a dead button.
              if (router.canGoBack()) router.back();
              else router.replace('/(requester)');
            }}
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

        {showBar ? (
          <View style={styles.stickyBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}>
              {categories.map((name) => {
                const selected = name === category;
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Show ${name}`}
                    onPress={() => setCategory(name)}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipSelected,
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      variant="secondary"
                      style={selected ? styles.chipLabelSelected : styles.chipLabel}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
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
          <View style={styles.list}>
            {visibleItems.map((item) => (
              <MenuItemRow
                key={item.id}
                item={item}
                onPress={openItem}
                thumbnail
                onAdd={quickAdd}
              />
            ))}
          </View>
        )}
      </Screen>
      <CartFab />
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
  stickyBar: {
    backgroundColor: colors.background,
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  chips: { gap: spacing.sm, paddingRight: spacing.xl },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipLabel: { fontWeight: '600', color: colors.secondary },
  chipLabelSelected: { fontWeight: '600', color: colors.onPrimary },
  list: { gap: spacing.md },
});
