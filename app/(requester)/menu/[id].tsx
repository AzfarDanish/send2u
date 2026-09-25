import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceholderImage } from '@/components/PlaceholderImage';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonDetail } from '@/components/ui/LoadingBlocks';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useCart } from '@/contexts/CartContext';
import { useMenu } from '@/hooks/useMenu';
import { formatMYR } from '@/lib/money';
import { getMenuItem } from '@/services/menu';
import type { MenuItemWithVendor } from '@/types/domain';

const COVER_HEIGHT = 340;
const MAX_ADDONS = 4;

/**
 * Menu item detail: the food image is the complete top header (it owns
 * the status-bar area — no white header above it). A rounded white sheet
 * overlaps the image with name, price, description, option rows, and
 * quantity; a fixed red Add to Cart bar stays pinned at the bottom.
 *
 * Options are real data: other available dishes from the same vendor act
 * as add-ons (name + additional price + checkbox). The backend has no
 * modifier/option columns, so nothing is invented — when the vendor has
 * no other dishes, the section says so.
 */
export default function MenuItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const { sections } = useMenu();
  const [item, setItem] = useState<MenuItemWithVendor | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [favorite, setFavorite] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  // Reset per-item state during render when the route id changes (the
  // React-endorsed alternative to setState-in-effect); the effect below
  // then only performs the async fetch. Inert on mount.
  const [seenId, setSeenId] = useState(id);
  if (seenId !== id) {
    setSeenId(id);
    setStatus('loading');
    setItem(null);
    setLoadFailed(false);
    setQuantity(1);
    setFavorite(false);
    setSelectedAddons([]);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const found = typeof id === 'string' ? await getMenuItem(id) : null;
        if (mounted) {
          setItem(found);
          setLoadFailed(false);
          setStatus(found ? 'ready' : 'missing');
        }
      } catch {
        if (mounted) {
          setItem(null);
          setLoadFailed(true);
          setStatus('missing');
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, retryToken]);

  // Image header owns the status-bar area once loaded; plain states keep
  // the default dark content.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setStyle(status === 'ready' ? 'light' : 'dark');
    }, [status]),
  );

  const addons = useMemo(() => {
    if (!item) return [];
    const section = sections.find((s) => s.vendor.id === item.vendorId);
    if (!section) return [];
    return section.items
      .filter((entry) => entry.id !== item.id && entry.isAvailable)
      .slice(0, MAX_ADDONS);
  }, [sections, item]);

  const addonTotal = useMemo(() => {
    const byId = new Map(addons.map((addon) => [addon.id, addon]));
    return selectedAddons.reduce((sum, addonId) => sum + (byId.get(addonId)?.priceCents ?? 0), 0);
  }, [addons, selectedAddons]);

  const total = (item?.priceCents ?? 0) * quantity + addonTotal;

  const toggleAddon = useCallback((addonId: string) => {
    setSelectedAddons((was) =>
      was.includes(addonId) ? was.filter((entry) => entry !== addonId) : [...was, addonId],
    );
  }, []);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(requester)');
  }, []);

  const handleShare = useCallback(() => {
    if (!item) return;
    try {
      void Share.share({
        message: `${item.name} — ${formatMYR(item.priceCents)} at ${item.vendor.name} via Send2U`,
      }).catch(() => {});
    } catch {
      // Best-effort: sharing is never on the order path.
    }
  }, [item]);

  const handleAdd = useCallback(() => {
    if (!item || !item.isAvailable) return;
    addItem(item, quantity);
    const byId = new Map(addons.map((addon) => [addon.id, addon]));
    for (const addonId of selectedAddons) {
      const addon = byId.get(addonId);
      if (addon) addItem(addon, 1);
    }
    router.push('/(requester)/create');
  }, [item, quantity, addons, selectedAddons, addItem]);

  if (status === 'loading' || !item) {
    return (
      <View style={[styles.stateRoot, { paddingTop: insets.top }]}>
        {status === 'loading' ? (
          <SkeletonDetail blocks={2} rows={2} label="Loading item" />
        ) : loadFailed ? (
          <ErrorState
            title="Couldn't load this item"
            message="Check your connection and try again."
            retryTitle="Try again"
            onRetry={() => {
              setLoadFailed(false);
              setStatus('loading');
              setRetryToken((t) => t + 1);
            }}
          />
        ) : (
          <ErrorState
            title="Item unavailable"
            message="This dish isn't on the menu right now. Pick something else tasty."
            retryTitle="Back to menu"
            onRetry={goBack}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}>
        <View style={styles.cover}>
          <PlaceholderImage style={StyleSheet.absoluteFill} />
          <View style={[styles.navRow, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={goBack}
              style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
              hitSlop={8}>
              <MaterialIcons name="chevron-left" size={26} color={colors.onPrimary} />
            </Pressable>
            <View style={styles.navRight}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={favorite ? 'Remove from favorites' : 'Save to favorites'}
                accessibilityState={{ selected: favorite }}
                onPress={() => setFavorite((was) => !was)}
                style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
                hitSlop={8}>
                <MaterialIcons
                  name={favorite ? 'favorite' : 'favorite-border'}
                  size={22}
                  color={colors.onPrimary}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Share ${item.name}`}
                onPress={handleShare}
                style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
                hitSlop={8}>
                <MaterialIcons name="share" size={22} color={colors.onPrimary} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.dragIndicator} />
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.price}>{formatMYR(item.priceCents)}</Text>
          <Text variant="secondary" color="secondary" numberOfLines={2}>
            {item.vendor.name}
            {item.vendor.locationHint ? ` • ${item.vendor.locationHint}` : ''}
            {item.isAvailable ? '' : ' • Unavailable right now'}
          </Text>
          {item.description ? (
            <Text style={styles.description}>{item.description}</Text>
          ) : null}

          <View style={styles.optionsBlock}>
            <Text style={styles.sectionTitle}>Options</Text>
            {addons.length === 0 ? (
              <Text variant="secondary" color="secondary">
                No add-ons for this item.
              </Text>
            ) : (
              <View>
                {addons.map((addon, index) => {
                  const selected = selectedAddons.includes(addon.id);
                  return (
                    <PressableScale
                      key={addon.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${addon.name}, plus ${formatMYR(addon.priceCents)}`}
                      onPress={() => toggleAddon(addon.id)}
                      haptic="selection"
                      style={[
                        styles.optionRow,
                        index < addons.length - 1 && styles.optionDivider,
                      ]}>
                      <Text variant="secondary" style={styles.optionName} numberOfLines={2}>
                        {addon.name}
                      </Text>
                      <Text style={styles.optionPrice}>+{formatMYR(addon.priceCents)}</Text>
                      <MaterialIcons
                        name={selected ? 'check-box' : 'check-box-outline-blank'}
                        size={24}
                        color={selected ? colors.primary : colors.muted}
                      />
                    </PressableScale>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.quantityBlock}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.quantityRow}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                accessibilityState={{ disabled: quantity <= 1 }}
                disabled={quantity <= 1}
                onPress={() => setQuantity((was) => Math.max(1, was - 1))}
                haptic="selection"
                hitSlop={8}
                style={[styles.stepper, quantity <= 1 && styles.stepperDisabled]}>
                <MaterialIcons
                  name="remove"
                  size={20}
                  color={quantity <= 1 ? colors.disabled : colors.text}
                />
              </PressableScale>
              <Text style={styles.quantityValue}>{quantity}</Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                accessibilityState={{ disabled: quantity >= 99 }}
                disabled={quantity >= 99}
                onPress={() => setQuantity((was) => Math.min(99, was + 1))}
                haptic="selection"
                hitSlop={8}
                style={[styles.stepper, quantity >= 99 && styles.stepperDisabled]}>
                <MaterialIcons
                  name="add"
                  size={20}
                  color={quantity >= 99 ? colors.disabled : colors.text}
                />
              </PressableScale>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Add to cart, total ${formatMYR(total)}`}
          accessibilityState={{ disabled: !item.isAvailable }}
          onPress={handleAdd}
          disabled={!item.isAvailable}
          haptic="light"
          style={[styles.actionButton, !item.isAvailable && styles.actionDisabled]}>
          <Text style={styles.actionLabel}>
            {item.isAvailable ? 'Add to Cart' : 'Unavailable right now'}
          </Text>
          <Text style={styles.actionTotal}>{formatMYR(total)}</Text>
        </PressableScale>
      </View>
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
  scrollBody: { paddingBottom: 132, flexGrow: 1 },
  cover: {
    height: COVER_HEIGHT,
    backgroundColor: colors.surfaceSecondary,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  navRight: { flexDirection: 'row', gap: spacing.sm },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  sheet: {
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  dragIndicator: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  price: {
    color: colors.primary,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  description: {
    color: colors.secondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  optionsBlock: { gap: spacing.sm, marginTop: spacing.lg },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  optionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  optionName: { flex: 1, color: colors.text },
  optionPrice: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  quantityBlock: { gap: spacing.sm, marginTop: spacing.lg },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stepper: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDisabled: { opacity: 0.5 },
  quantityValue: {
    minWidth: 40,
    textAlign: 'center',
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
  },
  actionDisabled: { backgroundColor: colors.disabledBackground },
  actionLabel: {
    color: colors.onPrimary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  actionTotal: {
    color: colors.onPrimary,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
