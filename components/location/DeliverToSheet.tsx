import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { springDefault } from '@/constants/motion';
import { colors, radii, spacing, touchTargets } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  useSavedDeliveryLocations,
  type SavedLocationsStatus,
} from '@/hooks/useSavedDeliveryLocations';
import type { SavedDeliveryLocation, SavedLocationType } from '@/types/domain';

/** Sheet corner radius; matches the home white sheet. */
const SHEET_RADIUS = 20;
/** Entrance offset the sheet springs up from; the backdrop itself only fades. */
const SHEET_ENTER_RISE = 80;
/** Downward drag that dismisses the sheet on release. */
const DISMISS_DISTANCE = 120;
/** Downward fling velocity that dismisses the sheet regardless of distance. */
const DISMISS_VELOCITY = 800;

/**
 * Category icon per saved-location type. `class` covers class/academic blocks,
 * `hostel` covers residential colleges, and unknown values fall back to
 * `place` so new types never render blank.
 */
const LOCATION_TYPE_ICON: Record<SavedLocationType, keyof typeof MaterialIcons.glyphMap> = {
  home: 'home',
  library: 'local-library',
  class: 'school',
  hostel: 'hotel',
  cafeteria: 'restaurant',
  office: 'business',
  other: 'place',
};

export function locationTypeIcon(
  locationType: SavedLocationType,
): keyof typeof MaterialIcons.glyphMap {
  return LOCATION_TYPE_ICON[locationType] ?? 'place';
}

export interface DeliverToSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Controlled list. Defaults to the caller's address book from the hook. */
  locations?: SavedDeliveryLocation[];
  /** Controlled active id. Defaults to the row flagged `isSelected`. */
  activeLocationId?: string | null;
  /** Controlled selection. Defaults to the atomic server-side setter. */
  onSelect?: (id: string) => void | Promise<void>;
  /** Defaults to the Set Location flow for that row. */
  onEdit?: (location: SavedDeliveryLocation) => void;
  /** Defaults to the Set Location flow for a new row. */
  onAdd?: () => void;
  status?: SavedLocationsStatus;
  error?: string | null;
  onRetry?: () => void;
  /**
   * Fires on the closed→open transition only (a modal open fires no screen
   * focus event, so the parent's focus refetch can't cover it). Callers
   * pass their address-book `refresh` so the sheet never opens on rows that
   * went stale while it was closed. Must be referentially stable — an
   * inline closure would refire on every parent render.
   */
  onOpenRefresh?: () => void;
}

/**
 * Deliver-to bottom sheet: the requester's personal address book opened from
 * the home location display. Drag handle, "Deliver to" header with close,
 * single-select radio list with per-type icons and per-row edit, and a
 * separated "Add new location" action. Dismisses via close, backdrop, the
 * Android back button, or a downward drag/fling on the handle zone.
 *
 * Data stays generic: any row count, any `SavedLocationType`, any label and
 * sub-details content. Uncontrolled by default (hook + service + RPCs);
 * every data prop is overridable for tests and previews.
 */
export function DeliverToSheet({
  visible,
  onClose,
  locations: controlledLocations,
  activeLocationId: controlledActiveId,
  onSelect: controlledSelect,
  onEdit: controlledEdit,
  onAdd: controlledAdd,
  status: controlledStatus,
  error: controlledError,
  onRetry: controlledRetry,
  onOpenRefresh,
}: DeliverToSheetProps) {
  const insets = useSafeAreaInsets();
  const managed = useSavedDeliveryLocations();

  const locations = controlledLocations ?? managed.locations;
  const activeLocationId = controlledActiveId ?? managed.activeLocationId;
  const status = controlledStatus ?? managed.status;
  const error = controlledError ?? managed.error;
  const handleRetry = controlledRetry ?? managed.retry;
  const selectingId = controlledLocations ? null : managed.selectingId;

  const handleAdd =
    controlledAdd ??
    (() => {
      onClose();
      router.push('/(requester)/set-location');
    });
  const handleEdit =
    controlledEdit ??
    ((location: SavedDeliveryLocation) => {
      onClose();
      router.push({ pathname: '/(requester)/set-location', params: { id: location.id } });
    });
  const handleSelect =
    controlledSelect ?? ((id: string) => void managed.selectLocation(id));

  // Drag-to-dismiss state. A shared value (not React state) so the gesture
  // runs on the UI thread; `.set()` rather than the `.value` setter, which
  // is what the compiler-aware lint rules want.
  const dragY = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  /** Entrance offset for the sheet; the backdrop itself only fades. */
  const riseY = useSharedValue(SHEET_ENTER_RISE);

  useEffect(() => {
    if (visible) dragY.set(0);
  }, [visible, dragY]);

  // Opening the modal fires no screen focus event, so a sheet reopened
  // after an out-of-band change (background edit, second device) would show
  // stale rows. Refresh once per closed→open transition — the preserving
  // silent kind, so visible rows never flash.
  const wasVisible = useRef(visible);
  const onOpenRefreshRef = useRef(onOpenRefresh);
  useEffect(() => {
    onOpenRefreshRef.current = onOpenRefresh;
  }, [onOpenRefresh]);
  useEffect(() => {
    const opened = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (opened) onOpenRefreshRef.current?.();
  }, [visible]);

  /**
   * Entrance. The modal fades the whole surface in and the sheet adds a short
   * upward spring on top of that fade. The fade is the point: when the modal owns
   * a slide animation, the dim layer travels up with it as a dark rectangle and
   * its hard top edge is visible the whole way.
   */
  useEffect(() => {
    // Nothing on close: the modal is fading out and moving the sheet now would
    // make it jump. The rise is re-armed on the next open instead.
    if (!visible) return;
    if (reducedMotion) {
      riseY.set(0);
      return;
    }
    // Start below and let the spring carry it up. Note the reset only happens
    // here, for the reason above.
    riseY.set(SHEET_ENTER_RISE);
    riseY.value = withSpring(0, springDefault);
  }, [visible, reducedMotion, riseY]);

  const dismissGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .failOffsetX([-15, 15])
        .onUpdate((event) => {
          // Reanimated shared-value write (UI-thread gesture input) — intended API.
          // eslint-disable-next-line react-hooks/immutability
          if (event.translationY > 0) dragY.value = event.translationY;
        })
        .onEnd((event) => {
          if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
            runOnJS(onClose)();
          } else {
            // Reanimated shared-value write (UI-thread spring input) — intended API.
            // eslint-disable-next-line react-hooks/immutability
            dragY.value = withSpring(0, { damping: 28, stiffness: 320 });
          }
        }),
    [dragY, onClose],
  );
  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    // Drag and entrance add up; during a drag the rise is already back at zero.
    transform: [{ translateY: Math.max(0, dragY.value) + riseY.value }],
  }));

  return (
    // Fade, not slide: a sliding modal carries its dim layer up with it, so the
    // dark backdrop reads as a shape rising from the bottom edge.
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss delivery locations"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />
        <Animated.View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 8) + spacing.lg }, sheetAnimatedStyle]}
          accessibilityRole="menu"
          accessibilityLabel="Deliver to">
          <GestureDetector gesture={dismissGesture}>
            <View>
              <View style={styles.handleZone}>
                <View style={styles.handle} />
              </View>
              <View style={styles.headerRow}>
                <Text variant="title">Deliver to</Text>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Close delivery locations"
                  onPress={onClose}
                  haptic="selection"
                  hitSlop={8}
                  style={styles.closeHit}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </PressableScale>
              </View>
            </View>
          </GestureDetector>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {status === 'loading' ? (
              <SkeletonList rows={3} lines={2} thumb={44} label="Loading saved locations" />
            ) : null}
            {status === 'error' ? (
              <ErrorState
                title="Couldn't load locations"
                message={error ?? 'Check your connection and try again.'}
                retryTitle="Try again"
                onRetry={handleRetry}
              />
            ) : null}
            {status === 'empty' ? (
              <EmptyState
                icon="place"
                title="No saved locations"
                message="Add your first delivery spot to get started."
              />
            ) : null}
            {status === 'ready'
              ? locations.map((location) => {
                  const selected = location.id === activeLocationId;
                  const selecting = selectingId === location.id;
                  return (
                    <PressableScale
                      key={location.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: selecting }}
                      accessibilityLabel={`${location.label}${selected ? ', selected delivery location' : ''}`}
                      onPress={() => {
                        if (!selected && !selecting) void handleSelect(location.id);
                      }}
                      haptic="selection"
                      style={styles.row}>
                      <View style={styles.radioWrap}>
                        {selecting ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <MaterialIcons
                            name={selected ? 'radio-button-checked' : 'radio-button-off'}
                            size={24}
                            color={selected ? colors.primary : colors.muted}
                          />
                        )}
                      </View>
                      <View style={styles.iconWrap}>
                        <MaterialIcons
                          name={locationTypeIcon(location.locationType)}
                          size={22}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.textBlock}>
                        <Text variant="secondary" style={styles.rowTitle} numberOfLines={1}>
                          {location.label}
                        </Text>
                        {location.subDetails ? (
                          <Text variant="caption" color="secondary" numberOfLines={2}>
                            {location.subDetails}
                          </Text>
                        ) : null}
                      </View>
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${location.label}`}
                        onPress={() => handleEdit(location)}
                        haptic="selection"
                        hitSlop={8}
                        style={styles.editHit}>
                        <MaterialIcons name="edit" size={22} color={colors.muted} />
                      </PressableScale>
                    </PressableScale>
                  );
                })
              : null}
          </ScrollView>

          <View style={styles.footer}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Add new location"
              onPress={handleAdd}
              haptic="selection"
              style={styles.addRow}>
              <View style={styles.iconWrap}>
                <MaterialIcons name="add" size={22} color={colors.primary} />
              </View>
              <Text variant="secondary" style={styles.addLabel}>
                Add new location
              </Text>
            </PressableScale>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  // Dim lives under the sheet: the backdrop Pressable above owns the taps,
  // so this layer never swallows them.
  dim: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingTop: spacing.sm,
    maxHeight: '82%',
  },
  handleZone: { alignItems: 'center', paddingVertical: spacing.sm },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    minHeight: 48,
  },
  closeHit: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flexShrink: 1 },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTargets.listRow,
    paddingVertical: spacing.sm,
  },
  radioWrap: { width: 28, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: 2 },
  rowTitle: { fontWeight: '600', color: colors.text },
  editHit: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Visually separated from the saved rows by a hairline, with its own
  // touch row — never just another radio row.
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTargets.listRow,
    paddingVertical: spacing.sm,
  },
  addLabel: { fontWeight: '600', color: colors.primary },
});
