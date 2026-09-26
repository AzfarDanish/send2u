import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassHeader } from '@/components/GlassHeader';
import { DeliveryMap } from '@/components/map/DeliveryMap';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonList } from '@/components/ui/LoadingBlocks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { useDeliveryLocations } from '@/hooks/useDeliveryLocations';
import type { LatLng, MapEvent, MapPoint } from '@/lib/maps/types';
import { LocationPinAlreadySetError, setDeliveryLocationPin } from '@/services/locations';

/**
 * Drop-off pin placement. The requester who chooses a campus point is the only
 * person who actually knows where on the ground it is, so they place its pin
 * here, from the map, on their own device.
 *
 * The tapped coordinate comes from the map's own projection of the touch and is
 * what gets written — the device GPS is deliberately not involved, so this
 * screen asks for no location permission and works indoors, where the point
 * being pinned usually is.
 *
 * A drop-off pin is placed once. The database refuses a second write, so this
 * screen never offers one: an already-pinned point is shown read-only, and the
 * refusal that arrives when someone else pinned it between the read and the tap
 * is surfaced as that same read-only state rather than as a retryable failure.
 */
export default function DropOffPinScreen() {
  const { locationId } = useLocalSearchParams<{ locationId?: string }>();
  const pointId = typeof locationId === 'string' && locationId.length > 0 ? locationId : null;
  const { locations, status, error, retry } = useDeliveryLocations();

  const [draft, setDraft] = useState<LatLng | null>(null);
  // What the server confirmed it stored. Kept apart from the draft because only
  // this one may be presented as saved.
  const [savedPin, setSavedPin] = useState<LatLng | null>(null);
  const [alreadySet, setAlreadySet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const picked = useRef(false);

  const location =
    status === 'ready' && pointId ? (locations.find((item) => item.id === pointId) ?? null) : null;

  const existingPin = useMemo<LatLng | null>(() => {
    if (!location || location.lat === null || location.lng === null) return null;
    return { latitude: location.lat, longitude: location.lng };
  }, [location]);

  const storedPin = savedPin ?? existingPin;
  // Set once and then permanent: a stored pin, or a refusal from the database,
  // both end pick mode. Nothing on this screen writes a second time.
  const readOnly = storedPin !== null || alreadySet;

  const points = useMemo<MapPoint[]>(() => {
    const coordinate = storedPin ?? draft;
    if (!coordinate || !location) return [];
    return [{ kind: 'dropoff', key: 'dropoff', coordinate, label: location.name }];
  }, [draft, location, storedPin]);

  const handleMapEvent = useCallback((event: MapEvent) => {
    if (event.type !== 'map-tap') return;
    if (!picked.current) {
      picked.current = true;
      // A point that has never been pinned gives the camera nothing to look at,
      // so the first tap is also the one that refits it: from then on the pin
      // moves under a camera the user has taken over.
      setFitToken((token) => token + 1);
    }
    setDraft(event.coordinate);
  }, []);

  const handleSave = useCallback(async () => {
    if (!pointId || !draft || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      setSavedPin(await setDeliveryLocationPin(pointId, draft));
      setDraft(null);
    } catch (err) {
      if (err instanceof LocationPinAlreadySetError) {
        // Refused by design, not a failure: drop the tap, reload the point so
        // the pin someone else placed is the one shown, and stop offering to
        // write anything.
        setDraft(null);
        setAlreadySet(true);
        retry();
      } else {
        setSaveError(err instanceof Error ? err.message : 'Could not save the drop-off pin.');
      }
    } finally {
      setSaving(false);
    }
  }, [draft, pointId, retry, saving]);

  return (
    <>
      <GlassHeader title="Drop-off pin" fallbackHref="/(requester)/location" />
      <Screen beneathHeader scrollable={false} contentStyle={styles.content}>
        <DeliveryMap
          points={points}
          route={null}
          fitToken={fitToken}
          pickMode={!readOnly && location !== null}
          locateControl
          onEvent={handleMapEvent}
          style={styles.map}
        />

        <View style={styles.footer}>
          {!pointId ? (
            <ErrorState
              title="No drop-off point"
              message="Open a drop-off point from the request to place its pin."
              retryTitle="Choose a point"
              onRetry={() => router.replace('/(requester)/location')}
            />
          ) : null}

          {pointId && status === 'loading' ? (
            <SkeletonList rows={1} lines={2} thumb={0} label="Loading the drop-off point" />
          ) : null}

          {pointId && status === 'error' ? (
            <ErrorState
              title="Couldn't load the drop-off point"
              message={error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={retry}
            />
          ) : null}

          {pointId && (status === 'empty' || (status === 'ready' && !location)) ? (
            <EmptyState
              icon="place"
              title="Drop-off point unavailable"
              message="This point is no longer offered. Pick another one for your request."
              actionTitle="Choose a point"
              onAction={() => router.replace('/(requester)/location')}
            />
          ) : null}

          {location && savedPin ? (
            <>
              <Text variant="secondary">Pin saved for {location.name}.</Text>
              <Button title="Done" onPress={() => router.back()} />
            </>
          ) : null}

          {location && !savedPin && existingPin ? (
            <Text variant="secondary">
              {location.name} already has its pin, placed by the requester who chose it. It is shown
              read-only here — moving it is an administrator&apos;s job.
            </Text>
          ) : null}

          {location && !savedPin && !existingPin && alreadySet ? (
            <Text variant="secondary">
              Another request placed this point&apos;s pin first. Reloading it now.
            </Text>
          ) : null}

          {location && !readOnly ? (
            <>
              <Text variant="secondary">
                Tap the exact spot for {location.name} on the map, then save it. A drop-off pin is
                placed once, so check it before saving.
              </Text>
              {saveError ? (
                <ErrorState
                  title="Could not save the pin"
                  message={saveError}
                  retryTitle="Try again"
                  onRetry={() => void handleSave()}
                />
              ) : null}
              <Button
                title="Save drop-off pin"
                onPress={() => void handleSave()}
                disabled={!draft || saving}
                loading={saving}
              />
            </>
          ) : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  // The map is the screen: it runs edge to edge, with only the action row
  // inset, so nothing competes with the pin being placed.
  content: { paddingHorizontal: 0, paddingBottom: spacing.lg, gap: spacing.md },
  map: { flex: 1, borderRadius: 0 },
  footer: { paddingHorizontal: spacing.xl, gap: spacing.sm },
});
