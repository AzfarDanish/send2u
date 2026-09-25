import { router, useFocusEffect } from 'expo-router';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceholderImage } from '@/components/PlaceholderImage';
import { SearchBar, matchesSearch } from '@/components/SearchBar';
import { CartFab } from '@/components/CartFab';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { useDeliveryLocations } from '@/hooks/useDeliveryLocations';
import { useMenu } from '@/hooks/useMenu';
import { formatMYR } from '@/lib/money';
import { useSharedUnreadCount } from '@/lib/unread';
import type { MenuItemWithVendor, Vendor } from '@/types/domain';

/** White sheet overlap over the red header; matches the sheet radius. */
const SHEET_OVERLAP = 20;
const SHEET_RADIUS = 20;
const POPULAR_COUNT = 10;
const VENDOR_PREVIEW_COUNT = 3;
/** Scroll distance over which the header fully collapses. */
const COLLAPSE_DISTANCE = 140;

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstNameOf(value: string | null | undefined): string | null {
  const first = (value ?? '').trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

/**
 * Requester home: red header (logo + bell, greeting, location with
 * chevron, pill search) over a rounded white sheet with Popular menu +
 * Vendors. Scrolling smoothly collapses the header down to the search
 * bar; the search never scrolls away and the header always stays red.
 */
export default function RequesterHomeScreen() {
  const insets = useSafeAreaInsets();
  const { sections, status, error, refreshing, retry, refresh } = useMenu();
  const { profile, user } = useAuth();
  const { locations } = useDeliveryLocations();
  const { locationId, addItem } = useCart();
  const unreadCount = useSharedUnreadCount();
  const [query, setQuery] = useState('');
  const [showAllVendors, setShowAllVendors] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const isSearching = deferredQuery.trim().length > 0;

  // Red header owns the status-bar area: light content stays readable.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setStyle('light');
    }, []),
  );

  // Collapse driver: scroll offset + measured full height of the
  // collapsible block (logo row, greeting, location).
  const scrollY = useSharedValue(0);
  const collapseHeight = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const collapseStyle = useAnimatedStyle(() => {
    const distance = Math.min(Math.max(scrollY.value, 0), COLLAPSE_DISTANCE);
    const progress = COLLAPSE_DISTANCE <= 0 ? 0 : distance / COLLAPSE_DISTANCE;
    return {
      height: collapseHeight.value * (1 - progress),
      opacity: Math.max(0, 1 - progress * 1.4),
    };
  });

  const openVendor = useCallback((vendor: Vendor) => {
    router.push({ pathname: '/(requester)/vendors/[id]', params: { id: vendor.id } });
  }, []);

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

  const greetingName =
    firstNameOf(profile?.fullName) ??
    firstNameOf(profile?.displayName) ??
    firstNameOf(user?.email?.split('@')[0] ?? null);
  const greeting = greetingName
    ? `${greetingForHour(new Date().getHours())}, ${greetingName}`
    : greetingForHour(new Date().getHours());

  const campusLabel =
    locations.find((location) => location.id === locationId)?.name ??
    locations[0]?.name ??
    'Campus';

  // One pick per vendor (available preferred): the popular shelf always
  // represents dishes from across the platform, never one stall twice.
  const popularItems = useMemo(() => {
    const picks: MenuItemWithVendor[] = [];
    for (const section of sections) {
      const pool = section.items.filter((item) => item.isAvailable);
      const pick = (pool.length > 0 ? pool : section.items)[0];
      if (pick) picks.push(pick);
      if (picks.length >= POPULAR_COUNT) break;
    }
    return picks;
  }, [sections]);

  // Client-side search over loaded menu data (no new queries).
  const visiblePopular = useMemo(() => {
    if (!isSearching) return popularItems;
    return popularItems.filter((item) =>
      matchesSearch(deferredQuery, item.name, item.description, item.vendor.name),
    );
  }, [popularItems, deferredQuery, isSearching]);

  const visibleSections = useMemo(() => {
    if (!isSearching) return sections;
    return sections.filter(
      (section) =>
        matchesSearch(
          deferredQuery,
          section.vendor.name,
          section.vendor.locationHint,
          section.vendor.operatingHours,
          section.vendor.description,
        ) ||
        section.items.some((item) =>
          matchesSearch(deferredQuery, item.name, item.description, section.vendor.name),
        ),
    );
  }, [sections, deferredQuery, isSearching]);

  const vendorsToShow =
    !isSearching && !showAllVendors
      ? visibleSections.slice(0, VENDOR_PREVIEW_COUNT)
      : visibleSections;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.collapseClip, collapseStyle]}>
          <View
            onLayout={(event) => {
              collapseHeight.value = event.nativeEvent.layout.height;
            }}>
            <View style={styles.topRow}>
              <Image
                source={require('../../assets/images/logo-white.png')}
                style={styles.wordmark}
                contentFit="contain"
                accessibilityLabel="Send2U"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
                }
                onPress={() => router.push('/(requester)/notifications')}
                style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
                hitSlop={8}>
                <MaterialIcons
                  name={unreadCount > 0 ? 'notifications' : 'notifications-none'}
                  size={26}
                  color={colors.onPrimary}
                />
                {unreadCount > 0 ? <View style={styles.bellDot} /> : null}
              </Pressable>
            </View>

            <Text style={styles.greeting}>{greeting}</Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delivery area: ${campusLabel}. Change drop-off location.`}
              onPress={() => router.push('/(requester)/locations')}
              style={({ pressed }) => [styles.locationRow, pressed && styles.pressed]}
              hitSlop={8}>
              <MaterialIcons name="place" size={14} color={colors.onPrimary} />
              <Text style={styles.locationLabel} numberOfLines={1}>
                {campusLabel}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={16} color={colors.onPrimary} />
            </Pressable>
          </View>
        </Animated.View>

        <View style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search for food or vendors"
            accessibilityLabel="Search for food or vendors"
            pill
          />
        </View>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetBody}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }>
        {status === 'loading' ? (
          <View style={styles.stateBlock}>
            <SkeletonList rows={4} lines={2} thumb={72} label="Loading menu" />
          </View>
        ) : null}
        {status === 'error' ? (
          <View style={styles.stateBlock}>
            <ErrorState
              title="Couldn't load the menu"
              message={error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={retry}
            />
          </View>
        ) : null}
        {status === 'empty' ? (
          <View style={styles.stateBlock}>
            <EmptyState
              icon="storefront"
              title="No vendors today"
              message="Pull down to check again."
            />
          </View>
        ) : null}
        {status === 'ready' && isSearching && visiblePopular.length === 0 && visibleSections.length === 0 ? (
          <View style={styles.stateBlock}>
            <EmptyState
              icon="search"
              title="No matches"
              message="Try a different vendor or dish."
            />
          </View>
        ) : null}

        {status === 'ready' && visiblePopular.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Popular menu</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.popularRow}>
              {visiblePopular.map((item) => (
                <PressableScale
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${formatMYR(item.priceCents)}${item.isAvailable ? '' : ', unavailable'}`}
                  onPress={() => openItem(item)}
                  haptic="selection"
                  style={styles.tile}>
                  <View style={styles.tileImageWrap}>
                    <PlaceholderImage style={styles.tileImage} />
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
                        size={18}
                        color={item.isAvailable ? colors.onPrimary : colors.disabled}
                      />
                    </PressableScale>
                  </View>
                  <Text style={styles.tileName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.tilePrice}>{formatMYR(item.priceCents)}</Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {status === 'ready' && vendorsToShow.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitlePlain}>Vendors</Text>
              {!isSearching && visibleSections.length > VENDOR_PREVIEW_COUNT ? (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={showAllVendors ? 'Show fewer vendors' : 'See all vendors'}
                  onPress={() => setShowAllVendors((was) => !was)}
                  haptic="selection"
                  hitSlop={8}
                  style={styles.seeAllHit}>
                  <Text style={styles.seeAll}>{showAllVendors ? 'See less' : 'See all'}</Text>
                </PressableScale>
              ) : null}
            </View>
            <View style={styles.vendorList}>
              {vendorsToShow.map((section) => {
                const vendor = section.vendor;
                const subtitle =
                  vendor.locationHint ??
                  vendor.operatingHours ??
                  vendor.description ??
                  (vendor.isOpen ? 'Open now' : 'Closed');
                return (
                  <PressableScale
                    key={vendor.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${vendor.name}${vendor.isOpen ? '' : ', closed'}`}
                    onPress={() => openVendor(vendor)}
                    haptic="selection"
                    style={styles.vendorRow}>
                    <PlaceholderImage style={StyleSheet.absoluteFill} />
                    <View style={styles.vendorOverlay} />
                    <View style={styles.vendorContent}>
                      <View style={styles.vendorText}>
                        <Text style={styles.vendorName} numberOfLines={1}>
                          {vendor.name}
                        </Text>
                        <Text style={styles.vendorSubtitle} numberOfLines={1}>
                          {subtitle}
                          {vendor.isOpen ? '' : ' • Closed'}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={26} color={colors.onPrimary} />
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
      <CartFab aboveTabs />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  header: {
    backgroundColor: colors.primary,
  },
  // Clips the collapsing block (logo row, greeting, location) as it
  // shrinks; the search below never moves.
  collapseClip: { overflow: 'hidden' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    minHeight: 56,
    marginTop: spacing.xs,
  },
  wordmark: {
    // logo-white.png is 1034x316 (~3.27:1); fixed height keeps the row
    // geometry identical on every device.
    width: 92,
    height: 28,
  },
  bell: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.onPrimary,
  },
  pressed: { opacity: 0.7 },
  greeting: {
    color: colors.onPrimary,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xs,
    minHeight: 28,
    alignSelf: 'flex-start',
  },
  locationLabel: {
    color: colors.onPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    opacity: 0.92,
    maxWidth: 260,
  },
  searchWrap: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    // Room for the white sheet to overlap the header bottom.
    marginBottom: SHEET_OVERLAP + spacing.lg,
  },
  // White sheet: rounded top corners only, overlapping the red header.
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    marginTop: -SHEET_OVERLAP,
    overflow: 'hidden',
  },
  sheetBody: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.xxl,
    flexGrow: 1,
  },
  stateBlock: { paddingHorizontal: spacing.xl },
  section: { gap: spacing.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
    paddingHorizontal: spacing.xl,
  },
  sectionTitlePlain: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  seeAllHit: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  seeAll: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  popularRow: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xs,
  },
  tile: { width: 132, gap: 4 },
  tileImageWrap: {
    width: 132,
    height: 104,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.xs,
  },
  tileImage: { width: '100%', height: '100%' },
  plus: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusDisabled: { backgroundColor: colors.disabledBackground },
  tileName: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  tilePrice: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  vendorList: { gap: spacing.md, paddingHorizontal: spacing.xl },
  vendorRow: {
    height: 148,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
  },
  vendorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  vendorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  vendorText: { flex: 1, gap: 2 },
  vendorName: {
    color: colors.onPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  vendorSubtitle: {
    color: colors.onPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    opacity: 0.88,
  },
});
