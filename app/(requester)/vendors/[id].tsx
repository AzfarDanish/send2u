import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceholderImage } from '@/components/PlaceholderImage';
import { CartFab } from '@/components/CartFab';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useMenu } from '@/hooks/useMenu';
import { formatMYR } from '@/lib/money';
import { useSharedUnreadCount } from '@/lib/unread';
import type { MenuItemWithVendor } from '@/types/domain';

/**
 * Client-side faceting only: the backend has no category column, so the
 * bar groups this vendor's real items by name hints. Items, prices, and
 * availability are untouched — only which tiles render changes.
 */
const NASI_HINTS = ['nasi', 'rice', 'beriani', 'biryani', 'briyani', 'kerabu'];
const MEE_HINTS = [
  'mee', 'maggie', 'noodle', 'bihun', 'bee hoon', 'kuey', 'laksa',
  'spaghetti', 'pasta', 'ramen', 'udon', 'soba', 'vermicelli', 'macaroni',
];
const SNACKS_HINTS = [
  'roti', 'karipap', 'curry puff', 'cucur', 'pisang', 'keropok', 'snack',
  'kuih', 'donut', 'cake', 'bun', 'sandwich', 'burger', 'fries', 'nugget',
  'samosa', 'popia', 'satay', 'sata', 'tauhu', 'apam', 'kebab', 'wrap',
  'pastry', 'cookie', 'keria', 'cempedak',
];
const DRINK_HINTS = [
  'teh', 'kopi', 'milo', 'nescafe', 'juice', 'jus', 'sirap', 'bandung',
  'latte', 'cappuccino', 'mocha', 'tea', 'coffee', 'susu', 'soya',
  'cendol', 'lemon', 'limau', 'cola', 'soda', 'drink', 'minuman',
];

type FoodCategory = 'Nasi' | 'Mee' | 'Snacks' | 'Drinks' | 'Others';

function foodCategory(item: MenuItemWithVendor): FoodCategory {
  const haystack = `${item.name} ${item.description ?? ''}`.toLowerCase();
  if (NASI_HINTS.some((hint) => haystack.includes(hint))) return 'Nasi';
  if (MEE_HINTS.some((hint) => haystack.includes(hint))) return 'Mee';
  if (SNACKS_HINTS.some((hint) => haystack.includes(hint))) return 'Snacks';
  if (DRINK_HINTS.some((hint) => haystack.includes(hint))) return 'Drinks';
  return 'Others';
}

const CATEGORY_ORDER: FoodCategory[] = ['Nasi', 'Mee', 'Snacks', 'Drinks', 'Others'];

/**
 * Vendor menu page: the vendor image is the complete top header (it owns
 * the status-bar area — no white nav above it). Navigation and vendor
 * identity overlay the image; below it sit the category bar and a
 * two-column food grid. No bordered cards anywhere.
 */
export default function VendorPageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { sections, status, error, retry } = useMenu();
  const { addItem } = useCart();
  const unreadCount = useSharedUnreadCount();
  const [seenId, setSeenId] = useState(id);
  const [category, setCategory] = useState('All');
  if (seenId !== id) {
    setSeenId(id);
    setCategory('All');
  }

  // Image header owns the status-bar area once loaded; plain states keep
  // the default dark content.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setStyle(status === 'ready' ? 'light' : 'dark');
    }, [status]),
  );

  const openItem = useCallback((item: MenuItemWithVendor) => {
    router.push({ pathname: '/(requester)/menu/[id]', params: { id: item.id } });
  }, []);

  const quickAdd = useCallback(
    (item: MenuItemWithVendor) => {
      if (!item.isAvailable) return;
      addItem(item, 1);
    },
    [addItem],
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(requester)');
  }, []);

  const section =
    typeof id === 'string' ? (sections.find((s) => s.vendor.id === id) ?? null) : null;

  const categories = useMemo(() => {
    const present = new Set<FoodCategory>();
    for (const item of section?.items ?? []) present.add(foodCategory(item));
    return ['All', ...CATEGORY_ORDER.filter((name) => present.has(name))];
  }, [section]);

  const visibleItems = useMemo(() => {
    const list = section?.items ?? [];
    if (category === 'All') return list;
    return list.filter((item) => foodCategory(item) === category);
  }, [section, category]);

  // Equal-width columns with consistent gaps; image ratio is fixed so
  // every tile lines up.
  const cellWidth = (width - spacing.xl * 2 - spacing.md) / 2;

  if (status === 'loading') {
    return (
      <View style={[styles.stateRoot, { paddingTop: insets.top }]}>
        <SkeletonList rows={4} lines={2} thumb={72} label="Loading vendor menu" />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.stateRoot, { paddingTop: insets.top }]}>
        <ErrorState
          title="Couldn't load the vendor"
          message={error ?? 'Check your connection and try again.'}
          retryTitle="Try again"
          onRetry={retry}
        />
      </View>
    );
  }

  if (!section) {
    return (
      <View style={[styles.stateRoot, { paddingTop: insets.top }]}>
        <ErrorState
          title="Vendor not found"
          message="This stall isn't available right now. Pick another vendor."
          retryTitle="Back to Home"
          onRetry={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(requester)');
          }}
        />
      </View>
    );
  }

  const { vendor, items } = section;
  // Popularity/open-state metadata only: the backend has no rating or
  // delivery-time columns, so the star row reports the real dish count,
  // open state, and hours rather than invented scores.
  const metaParts = [
    `★ ${items.length} dish${items.length === 1 ? '' : 'es'}`,
    vendor.isOpen ? 'Open' : 'Closed',
    vendor.operatingHours,
  ].filter((part): part is string => !!part && part.length > 0);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}>
        <View style={styles.cover}>
          <PlaceholderImage style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.30)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.68)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.navRow, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={goBack}
              style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
              hitSlop={8}>
              <MaterialIcons name="chevron-left" size={26} color={colors.onPrimary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
              }
              onPress={() => router.push('/(requester)/notifications')}
              style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
              hitSlop={8}>
              <MaterialIcons
                name={unreadCount > 0 ? 'notifications' : 'notifications-none'}
                size={22}
                color={colors.onPrimary}
              />
            </Pressable>
          </View>
          <View style={styles.coverInfo}>
            <Text style={styles.vendorName} numberOfLines={2}>
              {vendor.name}
            </Text>
            {vendor.locationHint ? (
              <Text style={styles.vendorSubtitle} numberOfLines={1}>
                {vendor.locationHint}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <MaterialIcons name="star" size={14} color="#FFC107" />
              <Text style={styles.metaText} numberOfLines={2}>
                {metaParts.join('  •  ').replace('★', '').trim()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.categoryBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}>
            {categories.map((name) => {
              const selected = name === category;
              return (
                <PressableScale
                  key={name}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Show ${name}`}
                  onPress={() => setCategory(name)}
                  haptic="selection"
                  hitSlop={4}
                  style={styles.categoryHit}>
                  <Text style={selected ? styles.categoryActive : styles.categoryIdle}>
                    {name}
                  </Text>
                  {selected ? <View style={styles.categoryIndicator} /> : null}
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>

        {items.length === 0 ? (
          <View style={styles.stateBlock}>
            <EmptyState
              icon="restaurant-menu"
              title="No items yet"
              message="This stall hasn't listed any food. Check back later."
            />
          </View>
        ) : visibleItems.length === 0 ? (
          <View style={styles.stateBlock}>
            <EmptyState
              icon="search"
              title="No matches"
              message="Try a different category."
            />
          </View>
        ) : (
          <View style={styles.grid}>
            {visibleItems.map((item) => (
              <PressableScale
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${formatMYR(item.priceCents)}${item.isAvailable ? '' : ', unavailable'}`}
                onPress={() => openItem(item)}
                haptic="selection"
                style={[styles.cell, { width: cellWidth }]}>
                <View style={styles.cellImageWrap}>
                  <PlaceholderImage style={styles.cellImage} />
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.name} to cart`}
                    accessibilityState={{ disabled: !item.isAvailable }}
                    onPress={() => quickAdd(item)}
                    disabled={!item.isAvailable}
                    hitSlop={8}
                    haptic="light"
                    style={[styles.plus, !item.isAvailable && styles.plusDisabled]}>
                    <MaterialIcons
                      name="add"
                      size={20}
                      color={item.isAvailable ? colors.onPrimary : colors.disabled}
                    />
                  </PressableScale>
                </View>
                <Text style={styles.cellName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.cellPrice}>{formatMYR(item.priceCents)}</Text>
              </PressableScale>
            ))}
          </View>
        )}
      </ScrollView>
      <CartFab aboveTabs />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  stateRoot: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollBody: { paddingBottom: spacing.xxxl },
  cover: {
    height: 300,
    backgroundColor: colors.surfaceSecondary,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  coverInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: 4,
  },
  vendorName: {
    color: colors.onPrimary,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  vendorSubtitle: {
    color: colors.onPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    opacity: 0.9,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: {
    flex: 1,
    color: colors.onPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    opacity: 0.92,
  },
  categoryBar: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  categoryRow: {
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  categoryHit: {
    minWidth: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  categoryIdle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  categoryActive: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  categoryIndicator: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  stateBlock: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  cell: { gap: 4 },
  cellImageWrap: {
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.xs,
  },
  cellImage: { width: '100%', height: '100%' },
  plus: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusDisabled: { backgroundColor: colors.disabledBackground },
  cellName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  cellPrice: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
