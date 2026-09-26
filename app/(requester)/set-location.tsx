import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassHeader, GLASS_HEADER_ROW } from '@/components/GlassHeader';
import { locationTypeIcon } from '@/components/location/DeliverToSheet';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { matchesSearch } from '@/components/SearchBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { SkeletonForm } from '@/components/ui/LoadingBlocks';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useDeliveryLocations } from '@/hooks/useDeliveryLocations';
import { useMenu } from '@/hooks/useMenu';
import {
  INSTRUCTIONS_MAX_LENGTH,
  LOCATION_CATEGORIES,
  formatCoordinate,
  isSetLocationValid,
  resolveLocationText,
  resolveSavedLabel,
  resolveSavedSubDetails,
  validateSetLocation,
} from '@/lib/locationDetails';
import { reverseGeocodePoint, type ReverseGeocodeResult } from '@/lib/maps/geocode';
import type { LatLng, MapEvent, MapPoint } from '@/lib/maps/types';
import { goBackOr } from '@/lib/navigation';
import {
  createSavedDeliveryLocation,
  listSavedDeliveryLocations,
  updateSavedDeliveryLocation,
} from '@/services/savedLocations';
import type { SavedLocationType } from '@/types/domain';

/**
 * Sheet chrome and snap geometry. Exactly two snaps — peek and expanded.
 * The sheet never slides off-screen (no hidden state) and never covers the
 * map's top strip (no fullscreen state).
 */
/** Visible sheet height at rest: handle + search + pin line + a sliver of form. */
const COLLAPSED_VISIBLE = 216;
/** Map strip left visible above the expanded sheet. */
const MAP_PEEK = 120;
/** Drag-zone height around the handle: generous target, slim chrome. */
const DRAG_ZONE_HEIGHT = 36;
const SEARCH_SUGGESTION_COUNT = 5;
/** Reverse lookup waits for the camera to settle before asking the OS. */
const GEOCODE_DEBOUNCE_MS = 800;
const SHEET_SPRING = { damping: 30, stiffness: 300 };
const FLING_VELOCITY = 500;

/**
 * Set Location, one single page: a full-bleed map with a slideable bottom
 * sheet carrying the search bar and the whole form. Creates a new saved
 * location, or edits the one named by `?id=`.
 *
 * The pin is a map marker at the selected coordinate — it stays glued to the
 * ground while the sheet moves, which an overlay pin could never do once the
 * sheet covers the map's centre. Panning the map drops the marker at the
 * settled centre (`center-changed`); the locate control recenters on the
 * device. Nearby landmark labels come free with the OSM raster tiles.
 *
 * Nothing here hardcodes a building, a label, or a coordinate: the search and
 * the Building field draw on the campus dataset (drop-off points + vendors)
 * and the OS reverse-geocoder, both of which degrade to nothing.
 */
export default function SetLocationScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof id === 'string' && id.length > 0 ? id : null;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  // Form state — every field starts blank; edit mode prefills from the row.
  const [building, setBuilding] = useState('');
  const [block, setBlock] = useState('');
  const [floorLevel, setFloorLevel] = useState('');
  const [roomUnit, setRoomUnit] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState<SavedLocationType | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [pin, setPin] = useState<LatLng | null>(null);
  const [buildingFocused, setBuildingFocused] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [geoSuggestion, setGeoSuggestion] = useState<ReverseGeocodeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);

  // Sheet + search state.
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Edit-context load.
  const [editStatus, setEditStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>(
    editingId ? 'loading' : 'idle',
  );
  const [editError, setEditError] = useState<string | null>(null);

  const formScrollRef = useRef<ScrollView>(null);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geoRequest = useRef(0);

  // Snap geometry in window coordinates. The sheet is a full-height view
  // translated vertically: `collapsedTop` leaves only the peek visible,
  // `expandedTop` stops below the glass with a clear map strip between.
  const contentTop = insets.top + GLASS_HEADER_ROW + spacing.md;
  const expandedTop = contentTop + MAP_PEEK;
  const collapsedTop = windowHeight - COLLAPSED_VISIBLE;

  // Drag state lives in shared values so the gesture runs on the UI thread.
  // Snaps ride in shared values too, so rotation never leaves the worklet
  // holding stale geometry.
  const ty = useSharedValue(collapsedTop);
  const panStart = useSharedValue(collapsedTop);
  const snapTop = useSharedValue(expandedTop);
  const snapBottom = useSharedValue(collapsedTop);

  useEffect(() => {
    snapTop.set(expandedTop);
    snapBottom.set(collapsedTop);
    ty.set(expanded ? expandedTop : collapsedTop);
  }, [expandedTop, collapsedTop, expanded, ty, snapTop, snapBottom]);

  const expandSheet = useCallback(() => {
    // Reanimated shared-value write (UI-thread spring input) — intended API.
    // eslint-disable-next-line react-hooks/immutability
    ty.value = withSpring(snapTop.value, SHEET_SPRING);
    setExpanded(true);
  }, [ty, snapTop]);

  const collapseSheet = useCallback(() => {
    // Reanimated shared-value write (UI-thread spring input) — intended API.
    // eslint-disable-next-line react-hooks/immutability
    ty.value = withSpring(snapBottom.value, SHEET_SPRING);
    setExpanded(false);
  }, [ty, snapBottom]);

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .failOffsetX([-12, 12])
        .onBegin(() => {
          // Reanimated shared-value write (UI-thread gesture input) — intended API.
          // eslint-disable-next-line react-hooks/immutability
          panStart.value = ty.value;
        })
        .onUpdate((event) => {
          const next = panStart.value + event.translationY;
          // Clamped at both ends: never off-screen, never fullscreen.
          const clamped = Math.min(snapBottom.value, Math.max(snapTop.value, next));
          // Reanimated shared-value write (UI-thread gesture input) — intended API.
          // eslint-disable-next-line react-hooks/immutability
          ty.value = clamped;
        })
        .onEnd((event) => {
          const top = snapTop.value;
          const bottom = snapBottom.value;
          const middle = (top + bottom) / 2;
          let target = ty.value <= middle ? top : bottom;
          if (event.velocityY < -FLING_VELOCITY) target = top;
          else if (event.velocityY > FLING_VELOCITY) target = bottom;
          // Reanimated shared-value write (UI-thread spring input) — intended API.
          // eslint-disable-next-line react-hooks/immutability
          ty.value = withSpring(target, SHEET_SPRING);
          runOnJS(setExpanded)(target === top);
        }),
    [ty, panStart, snapTop, snapBottom],
  );
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  // Debounced OS lookup lives on a timer, never on state: clearing it needs
  // no render, and the unmount cleanup below issues no set-state either.
  useEffect(() => {
    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await listSavedDeliveryLocations();
        if (cancelled) return;
        const found = all.find((row) => row.id === editingId) ?? null;
        if (found) {
          setBuilding(found.building ?? (found.locationType === 'other' ? '' : found.label));
          setBlock(found.block ?? '');
          setFloorLevel(found.floorLevel ?? '');
          setRoomUnit(found.roomUnit ?? '');
          setInstructions(found.instructions ?? '');
          setCategory(found.locationType);
          setCustomLabel(found.customLabel ?? '');
          if (found.lat !== null && found.lng !== null) {
            setPin({ latitude: found.lat, longitude: found.lng });
            setFitToken((token) => token + 1);
          }
          setEditStatus('ready');
        } else {
          setEditStatus('empty');
        }
      } catch (err) {
        if (cancelled) return;
        setEditError(err instanceof Error ? err.message : 'Could not load the saved location.');
        setEditStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  const retryEdit = useCallback(() => {
    if (!editingId) return;
    setEditStatus('loading');
    setEditError(null);
    (async () => {
      try {
        const all = await listSavedDeliveryLocations();
        const found = all.find((row) => row.id === editingId) ?? null;
        if (found) {
          setBuilding(found.building ?? (found.locationType === 'other' ? '' : found.label));
          setBlock(found.block ?? '');
          setFloorLevel(found.floorLevel ?? '');
          setRoomUnit(found.roomUnit ?? '');
          setInstructions(found.instructions ?? '');
          setCategory(found.locationType);
          setCustomLabel(found.customLabel ?? '');
          if (found.lat !== null && found.lng !== null) {
            setPin({ latitude: found.lat, longitude: found.lng });
            setFitToken((token) => token + 1);
          }
          setEditStatus('ready');
        } else {
          setEditStatus('empty');
        }
      } catch (err) {
        setEditError(err instanceof Error ? err.message : 'Could not load the saved location.');
        setEditStatus('error');
      }
    })();
  }, [editingId]);

  const handleMapEvent = useCallback((event: MapEvent) => {
    if (event.type !== 'center-changed') return;
    setPin(event.coordinate);
    // The camera is still settling while the user keeps dragging: wait for a
    // pause before asking the OS, and let a newer pause win over this one.
    if (geoTimer.current) clearTimeout(geoTimer.current);
    const coordinate = event.coordinate;
    geoTimer.current = setTimeout(() => {
      geoRequest.current += 1;
      const request = geoRequest.current;
      void (async () => {
        const result = await reverseGeocodePoint(coordinate);
        if (geoRequest.current !== request) return;
        setGeoSuggestion(result);
      })();
    }, GEOCODE_DEBOUNCE_MS);
  }, []);

  // Campus search pool: drop-off points plus vendor names — the dataset that
  // already exists, filtered locally. No network, no generic web search.
  const { locations: dropPoints } = useDeliveryLocations();
  const { sections } = useMenu();
  const campusPool = useMemo(() => {
    const pool: { title: string; subtitle?: string }[] = [
      ...dropPoints.map((point) => ({ title: point.name, subtitle: point.description ?? undefined })),
      ...sections.map((section) => ({
        title: section.vendor.name,
        subtitle: section.vendor.locationHint ?? undefined,
      })),
    ];
    const seen = new Set<string>();
    return pool.filter((entry) => {
      const key = entry.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [dropPoints, sections]);

  const searchResults = useMemo(() => {
    if (query.trim().length < 2) return [];
    return campusPool
      .filter((entry) => matchesSearch(query, entry.title, entry.subtitle))
      .slice(0, SEARCH_SUGGESTION_COUNT);
  }, [query, campusPool]);
  const showSearchResults = query.trim().length >= 2;

  const suggestions = useMemo(() => {
    if (building.trim().length < 2) return [];
    return campusPool
      .filter((entry) => matchesSearch(building, entry.title, entry.subtitle))
      .slice(0, SEARCH_SUGGESTION_COUNT);
  }, [building, campusPool]);

  const markTouched = useCallback((key: string) => {
    setTouched((previous) => (previous[key] ? previous : { ...previous, [key]: true }));
  }, []);

  const selectSearchResult = useCallback(
    (title: string) => {
      setBuilding(title);
      markTouched('building');
      setQuery('');
      Keyboard.dismiss();
      expandSheet();
    },
    [expandSheet, markTouched],
  );

  const mapPoints = useMemo<MapPoint[]>(
    () => (pin ? [{ kind: 'dropoff', key: 'dropoff', coordinate: pin, label: 'Delivery point' }] : []),
    [pin],
  );

  const errors = validateSetLocation({
    building,
    category,
    customLabel,
    instructions,
    hasPin: pin !== null,
  });
  const editReady = editingId === null || editStatus === 'ready';
  const canSave = editReady && isSetLocationValid(errors) && !saving;

  const blocker =
    errors.pin ?? errors.building ?? errors.category ?? errors.customLabel ?? errors.instructions ?? null;

  const resolvedText = resolveLocationText({
    building,
    block,
    floorLevel,
    roomUnit,
    category,
    customLabel,
  });

  const handleSave = useCallback(async () => {
    if (!canSave || !category || !pin) return;
    setSaving(true);
    setSaveError(null);
    try {
      const input = {
        label: resolveSavedLabel({ building, category, customLabel }),
        subDetails: resolveSavedSubDetails({ block, floorLevel, roomUnit }),
        locationType: category,
        lat: pin.latitude,
        lng: pin.longitude,
        building: building.trim() === '' ? null : building.trim(),
        block: block.trim() === '' ? null : block.trim(),
        floorLevel: floorLevel.trim() === '' ? null : floorLevel.trim(),
        roomUnit: roomUnit.trim() === '' ? null : roomUnit.trim(),
        instructions: instructions.trim() === '' ? null : instructions,
        customLabel: customLabel.trim() === '' ? null : customLabel.trim(),
      };
      if (editingId) await updateSavedDeliveryLocation(editingId, input);
      else await createSavedDeliveryLocation(input);
      goBackOr('/(requester)');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the location.');
    } finally {
      setSaving(false);
    }
  }, [block, building, canSave, category, customLabel, editingId, floorLevel, instructions, pin, roomUnit]);

  const scrollToFields = useCallback(() => {
    formScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return (
    <View style={styles.root}>
      {/* Full-bleed map: the sheet floats over its bottom edge. */}
      <View style={[styles.mapArea, { top: contentTop, bottom: insets.bottom }]}>
        <DeliveryMap
          points={mapPoints}
          route={null}
          fitToken={fitToken}
          locateControl
          locateBottomInset={COLLAPSED_VISIBLE}
          onEvent={handleMapEvent}
          style={styles.map}
        />
      </View>

      {/* Slideable sheet: two snaps, never off-screen, never fullscreen. */}
      <Animated.View style={[styles.sheet, { height: windowHeight }, sheetStyle]}>
        <GestureDetector gesture={dragGesture}>
          <View
            style={styles.dragZone}
            accessibilityRole="adjustable"
            accessibilityLabel="Location form sheet. Drag up to expand, drag down to collapse."
            accessibilityActions={[
              { name: 'expand', label: 'Expand' },
              { name: 'collapse', label: 'Collapse' },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'expand') expandSheet();
              else collapseSheet();
            }}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>

        <View style={styles.searchWrap}>
          <View style={[styles.searchRow, searchFocused && styles.searchFocused]}>
            <MaterialIcons name="search" size={22} color={colors.secondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search campus locations"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              returnKeyType="search"
              onFocus={() => {
                setSearchFocused(true);
                expandSheet();
              }}
              onBlur={() => setSearchFocused(false)}
              onSubmitEditing={() => {
                if (searchResults.length > 0) selectSearchResult(searchResults[0].title);
              }}
              accessibilityLabel="Search campus locations"
              accessibilityRole="search"
              style={styles.searchInput}
            />
            {query.length > 0 ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                haptic="selection"
                hitSlop={8}
                style={styles.searchClear}>
                <MaterialIcons name="close" size={20} color={colors.secondary} />
              </PressableScale>
            ) : null}
          </View>
          {showSearchResults ? (
            <View style={styles.searchDropdown}>
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <PressableScale
                    key={result.title}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${result.title}`}
                    onPress={() => selectSearchResult(result.title)}
                    haptic="selection"
                    style={styles.suggestionRow}>
                    <MaterialIcons name="place" size={20} color={colors.primary} />
                    <View style={styles.suggestionText}>
                      <Text variant="secondary" style={styles.suggestionTitle} numberOfLines={1}>
                        {result.title}
                      </Text>
                      {result.subtitle ? (
                        <Text variant="caption" color="secondary" numberOfLines={1}>
                          {result.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </PressableScale>
                ))
              ) : (
                <Text variant="caption" color="muted" style={styles.noResults}>
                  No campus matches for “{query.trim()}”. Pan the map to place your pin instead.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {/* Live pin readout: part of the collapsed peek. */}
        <View style={styles.pinLine}>
          <MaterialIcons
            name="place"
            size={16}
            color={pin ? colors.primary : colors.muted}
          />
          <Text variant="caption" color="secondary" numberOfLines={1}>
            {pin
              ? `${formatCoordinate(pin.latitude)}, ${formatCoordinate(pin.longitude)}`
              : 'Pan the map to place your pin'}
          </Text>
        </View>

        <KeyboardAvoidingView
          style={styles.sheetBody}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {editingId !== null && editStatus !== 'ready' ? (
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}>
              {editStatus === 'loading' ? (
                <SkeletonForm fields={5} label="Loading saved location" />
              ) : null}
              {editStatus === 'error' ? (
                <ErrorState
                  title="Couldn't load the location"
                  message={editError ?? 'Check your connection and try again.'}
                  retryTitle="Try again"
                  onRetry={retryEdit}
                />
              ) : null}
              {editStatus === 'empty' ? (
                <EmptyState
                  icon="place"
                  title="Location not found"
                  message="That saved location is no longer available."
                />
              ) : null}
            </ScrollView>
          ) : (
            <ScrollView
              ref={formScrollRef}
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={expanded}>
              <View style={styles.headingBlock}>
                <Text variant="title">Where should we deliver?</Text>
                <Text color="secondary">
                  Pan the map — the pin drops at the centre when you release — then
                  describe the spot so your helper finds the exact door.
                </Text>
              </View>

              <View>
                <Input
                  label="Building / Facility"
                  placeholder="e.g. KK Block C, Main Library"
                  value={building}
                  onChangeText={setBuilding}
                  onFocus={() => {
                    setBuildingFocused(true);
                    expandSheet();
                  }}
                  onBlur={() => {
                    setBuildingFocused(false);
                    markTouched('building');
                  }}
                  error={touched.building ? (errors.building ?? null) : null}
                  returnKeyType="next"
                />
                {buildingFocused && suggestions.length > 0 ? (
                  <Card style={styles.suggestionCard}>
                    {suggestions.map((suggestion) => (
                      <PressableScale
                        key={suggestion.title}
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${suggestion.title}`}
                        onPress={() => {
                          setBuilding(suggestion.title);
                          setBuildingFocused(false);
                          markTouched('building');
                        }}
                        haptic="selection"
                        style={styles.suggestionRow}>
                        <MaterialIcons name="place" size={20} color={colors.primary} />
                        <View style={styles.suggestionText}>
                          <Text variant="secondary" style={styles.suggestionTitle} numberOfLines={1}>
                            {suggestion.title}
                          </Text>
                          {suggestion.subtitle ? (
                            <Text variant="caption" color="secondary" numberOfLines={1}>
                              {suggestion.subtitle}
                            </Text>
                          ) : null}
                        </View>
                      </PressableScale>
                    ))}
                  </Card>
                ) : null}
                {geoSuggestion && !buildingFocused ? (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`Use nearby place ${geoSuggestion.placeName}`}
                    onPress={() => {
                      setBuilding(geoSuggestion.placeName);
                      markTouched('building');
                    }}
                    haptic="selection"
                    style={styles.geoRow}>
                    <MaterialIcons name="near-me" size={20} color={colors.primary} />
                    <View style={styles.suggestionText}>
                      <Text variant="caption" color="secondary" numberOfLines={1}>
                        Nearby: {geoSuggestion.placeName}
                        {geoSuggestion.detail ? ` — ${geoSuggestion.detail}` : ''} · tap to use
                      </Text>
                    </View>
                  </PressableScale>
                ) : null}
              </View>

              <Input
                label="Block"
                placeholder="Free text, e.g. C"
                value={block}
                onChangeText={setBlock}
                onFocus={expandSheet}
                returnKeyType="next"
              />
              <Input
                label="Floor / Level"
                placeholder="Free text, e.g. Level 3"
                value={floorLevel}
                onChangeText={setFloorLevel}
                onFocus={expandSheet}
                returnKeyType="next"
              />
              <Input
                label="Room / Unit"
                placeholder="Free text, e.g. Room 12"
                value={roomUnit}
                onChangeText={setRoomUnit}
                onFocus={expandSheet}
                returnKeyType="next"
              />
              <Input
                label="Delivery instructions"
                placeholder="How does the helper recognise the spot?"
                value={instructions}
                onChangeText={setInstructions}
                onFocus={expandSheet}
                onBlur={() => markTouched('instructions')}
                error={touched.instructions ? (errors.instructions ?? null) : null}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                counterMax={INSTRUCTIONS_MAX_LENGTH}
              />

              <View style={styles.group}>
                <Text variant="subtitle">Location label</Text>
                <View style={styles.categoryGrid}>
                  {LOCATION_CATEGORIES.map((option) => {
                    const selected = category === option.type;
                    return (
                      <PressableScale
                        key={option.type}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${option.label}${selected ? ', selected' : ''}`}
                        onPress={() => {
                          setCategory(option.type);
                          markTouched('category');
                        }}
                        haptic="selection"
                        style={[styles.categoryOption, selected && styles.categorySelected]}>
                        <MaterialIcons
                          name={locationTypeIcon(option.type)}
                          size={24}
                          color={selected ? colors.primary : colors.muted}
                        />
                        <Text
                          variant="caption"
                          style={selected ? styles.categoryLabelSelected : styles.categoryLabel}>
                          {option.label}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
                {touched.category && errors.category ? (
                  <Text variant="caption" color="error" accessibilityRole="alert">
                    {errors.category}
                  </Text>
                ) : null}
              </View>

              {category === 'other' ? (
                <Input
                  label="Custom label"
                  placeholder="Name this location"
                  value={customLabel}
                  onChangeText={setCustomLabel}
                  onFocus={expandSheet}
                  onBlur={() => markTouched('customLabel')}
                  error={touched.customLabel ? (errors.customLabel ?? null) : null}
                  returnKeyType="next"
                />
              ) : null}

              {resolvedText !== '' || pin !== null ? (
                <Card style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryIcon}>
                      <MaterialIcons
                        name={locationTypeIcon(category ?? 'other')}
                        size={22}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.summaryText}>
                      <Text variant="subtitle">Selected location</Text>
                      {resolvedText !== '' ? (
                        <Text color="secondary">{resolvedText}</Text>
                      ) : null}
                      <Text variant="caption" color="muted" style={styles.coords}>
                        {pin
                          ? `${formatCoordinate(pin.latitude)}, ${formatCoordinate(pin.longitude)}`
                          : 'Pin not placed yet — pan the map.'}
                      </Text>
                    </View>
                  </View>
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel="Back to editing the fields"
                    onPress={scrollToFields}
                    haptic="selection"
                    hitSlop={8}
                    style={styles.summaryEdit}>
                    <Text variant="secondary" style={styles.summaryEditLabel}>
                      Edit fields
                    </Text>
                  </PressableScale>
                </Card>
              ) : null}

              <View style={styles.noteRow}>
                <MaterialIcons name="info-outline" size={18} color={colors.secondary} />
                <Text variant="caption" color="secondary" style={styles.noteText}>
                  Confirm the pin before saving: drag the map so the centre pin sits
                  exactly on your delivery spot.
                </Text>
              </View>
            </ScrollView>
          )}

          {/* Docked Save: sheet chrome, so it stays reachable while the form
              scrolls and rides above the keyboard. */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {saveError ? (
              <Text variant="caption" color="error" accessibilityRole="alert">
                {saveError}
              </Text>
            ) : null}
            {!canSave && !saveError && editReady && blocker ? (
              <Text variant="caption" color="muted">
                {blocker}
              </Text>
            ) : null}
            <Button
              title={editingId ? 'Save changes' : 'Save location'}
              onPress={() => void handleSave()}
              disabled={!canSave}
              loading={saving}
            />
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      <GlassHeader title={editingId ? 'Edit Location' : 'Set Location'} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  mapArea: { position: 'absolute', left: 0, right: 0 },
  map: { flex: 1, borderRadius: 0 },
  // The sheet is a full-height view translated vertically: only the window
  // between the two snaps is ever visible, so it can neither leave the
  // screen nor cover the map's top strip.
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  dragZone: {
    height: DRAG_ZONE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Subtle grey grabber: the sheet's only chrome, and its drag surface.
  handle: {
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  searchWrap: { paddingHorizontal: spacing.xl, zIndex: 30 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  searchFocused: { borderColor: colors.primary },
  searchInput: { flex: 1, paddingVertical: spacing.sm, fontSize: 16, color: colors.text },
  searchClear: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Overlays the form rather than pushing it, so the collapsed peek keeps
  // its height while results are open.
  searchDropdown: {
    position: 'absolute',
    top: '100%',
    left: spacing.xl,
    right: spacing.xl,
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    zIndex: 30,
    elevation: 6,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingVertical: spacing.xs,
  },
  suggestionText: { flex: 1, gap: 2 },
  suggestionTitle: { fontWeight: '600', color: colors.text },
  noResults: { paddingVertical: spacing.sm },
  pinLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    minHeight: 28,
  },
  sheetBody: { flex: 1 },
  formScroll: { flex: 1 },
  formContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  headingBlock: { gap: spacing.xs },
  suggestionCard: { marginTop: spacing.sm, gap: 0, paddingVertical: spacing.xs },
  geoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 44,
  },
  group: { gap: spacing.sm },
  // Data-driven grid: one more category is one more cell, no redesign.
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryOption: {
    flexGrow: 1,
    minWidth: 100,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  categorySelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  categoryLabel: { color: colors.secondary, textAlign: 'center' },
  categoryLabelSelected: { color: colors.primary, fontWeight: '600', textAlign: 'center' },
  summaryCard: { gap: spacing.sm },
  summaryRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: { flex: 1, gap: 2 },
  coords: { fontVariant: ['tabular-nums'] },
  summaryEdit: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  summaryEditLabel: { fontWeight: '600', color: colors.primary },
  noteRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noteText: { flex: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
});
