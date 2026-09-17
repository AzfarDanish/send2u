import { router } from 'expo-router';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { PlaceholderImage } from '@/components/PlaceholderImage';
import { MainHeader } from '@/components/MainHeader';
import { SearchBar, matchesSearch } from '@/components/SearchBar';
import { CartFab } from '@/components/CartFab';
import { VendorCard } from '@/components/VendorCard';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useMenu } from '@/hooks/useMenu';
import type { Vendor } from '@/types/domain';

export default function RequesterHomeScreen() {
  const { sections, status, error, refreshing, retry, refresh } = useMenu();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const isSearching = deferredQuery.trim().length > 0;

  const openVendor = useCallback((vendor: Vendor) => {
    router.push({ pathname: '/(requester)/vendors/[id]', params: { id: vendor.id } });
  }, []);

  // Client-side search over loaded menu data (no new queries): a vendor
  // stays visible when the vendor itself matches or when any of its items
  // match, so a dish search always leads somewhere tappable.
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

  return (
    <>
      <Screen
        underTabs
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }>
        <MainHeader
          title="Send2U"
          leading={
            <View style={styles.logoTile}>
              <MaterialIcons name="send" size={22} color={colors.secondary} />
            </View>
          }
        />

        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search vendors or dishes"
          accessibilityLabel="Search vendors or dishes"
        />

        <Text variant="title">What would you like to eat today?</Text>

        {!isSearching ? (
          <View style={styles.banner}>
            <View style={styles.bannerText}>
              <Text variant="title" style={styles.bannerTitle}>
                Good Food,{'\n'}Brighter Days
              </Text>
              <Text style={styles.bannerSubtitle}>From our campus vendors to you</Text>
            </View>
            <View style={styles.bannerTile}>
              <PlaceholderImage style={styles.bannerImage} />
            </View>
          </View>
        ) : null}

        <SectionHeader title="Available Vendors" />
        {status === 'loading' ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Loading vendors">
            {[0, 1, 2].map((row) => (
              <Card key={row} style={styles.vendorSkeleton}>
                <Skeleton width={64} height={64} radius={radii.md} />
                <View style={styles.skeletonText}>
                  <Skeleton width="60%" height={20} />
                  <Skeleton width="80%" height={14} />
                  <Skeleton width="30%" height={22} radius={radii.full} />
                </View>
              </Card>
            ))}
          </View>
        ) : null}
        {status === 'error' ? (
          <Card style={styles.stateCard}>
            <ErrorState
              title="Couldn't load vendors"
              message={error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={retry}
            />
          </Card>
        ) : null}
        {status === 'empty' ? (
          <EmptyState
            icon="storefront"
            title="No vendors today"
            message="Pull down to check again."
          />
        ) : null}
        {status === 'ready' && isSearching && visibleSections.length === 0 ? (
          <EmptyState
            icon="search"
            title="No matches"
            message="Try a different vendor or dish."
          />
        ) : null}
        {status === 'ready'
          ? visibleSections.map((section) => (
              <VendorCard
                key={section.vendor.id}
                vendor={section.vendor}
                onPress={openVendor}
              />
            ))
          : null}
      </Screen>
      <CartFab aboveTabs />
    </>
  );
}

const styles = StyleSheet.create({
  stateCard: { minHeight: 200, justifyContent: 'center' },
  logoTile: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
  },
  bannerText: { flex: 1, gap: spacing.xs },
  bannerTitle: { color: colors.onPrimary },
  bannerSubtitle: { color: colors.onPrimary, fontSize: 15, lineHeight: 22 },
  bannerTile: {
    width: 88,
    height: 88,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
  },
  bannerImage: { borderRadius: radii.lg },
  vendorSkeleton: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonText: { flex: 1, gap: spacing.xs },
});
