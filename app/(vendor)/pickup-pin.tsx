import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useMyVendor } from '@/hooks/useMyVendor';
import type { LatLng, MapEvent, MapPoint } from '@/lib/maps/types';
import { setMyPickupPin } from '@/services/vendor';

/**
 * Pickup pin placement for the signed-in vendor's own stall.
 *
 * A stall's free-text `locationHint` tells a person where to look; only a
 * coordinate tells a route where to end. The vendor is the one who knows which
 * counter that is, so they place the pin here, from the map, on their own
 * device — no GPS permission is needed, because the tap itself is the answer.
 *
 * Unlike a requester's drop-off pin, this one may be corrected later: a stall
 * moves, and the platform already lets a vendor update its own row, so an
 * existing pin is shown first and re-placing it is an explicit second action
 * rather than an accident waiting to happen.
 */
export default function PickupPinScreen() {
  const { vendor, status, error, retry } = useMyVendor();

  const [draft, setDraft] = useState<LatLng | null>(null);
  // What the server confirmed it stored. Kept apart from the draft because only
  // this one may be presented as saved.
  const [savedPin, setSavedPin] = useState<LatLng | null>(null);
  const [moving, setMoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const tapped = useRef(false);
  const fitted = useRef(false);

  const existingPin = useMemo<LatLng | null>(() => {
    if (!vendor || vendor.pickupLat === null || vendor.pickupLng === null) return null;
    return { latitude: vendor.pickupLat, longitude: vendor.pickupLng };
  }, [vendor]);

  const storedPin = savedPin ?? existingPin;
  // A stall with no pin is being placed; one with a pin is only being moved
  // once the vendor says so.
  const picking = savedPin === null && (existingPin === null || moving);
  const shownPin = savedPin ?? draft ?? existingPin;

  const points = useMemo<MapPoint[]>(() => {
    if (!shownPin || !vendor) return [];
    return [{ kind: 'vendor', key: 'vendor', coordinate: shownPin, label: vendor.name }];
  }, [shownPin, vendor]);

  // The pin only exists after the stall loads, and the map refits on request
  // rather than on its own: the first time a stored pin is known is that
  // request. Without it the camera would sit wherever the map started.
  useEffect(() => {
    if (fitted.current || !shownPin) return;
    fitted.current = true;
    setFitToken((token) => token + 1);
  }, [shownPin]);

  const handleMapEvent = useCallback((event: MapEvent) => {
    if (event.type !== 'map-tap') return;
    if (!tapped.current) {
      tapped.current = true;
      setFitToken((token) => token + 1);
    }
    setDraft(event.coordinate);
  }, []);

  const handleStartMove = useCallback(() => {
    if (!existingPin) return;
    // Start from where the pin is now, so moving it is a correction of a
    // visible point rather than a blind new guess — and bring the camera back
    // to it, since a cancel may have left the user somewhere else.
    setDraft(existingPin);
    setMoving(true);
    setSaveError(null);
    setFitToken((token) => token + 1);
  }, [existingPin]);

  const handleCancelMove = useCallback(() => {
    setDraft(null);
    setMoving(false);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await setMyPickupPin(draft);
      if (updated.pickupLat === null || updated.pickupLng === null) {
        throw new Error('Saving the pickup pin came back in an unexpected shape.');
      }
      // The stall is re-read rather than assumed: the pin shown as saved is the
      // one the database now holds.
      setSavedPin({ latitude: updated.pickupLat, longitude: updated.pickupLng });
      setDraft(null);
      setMoving(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save the pickup pin.');
    } finally {
      setSaving(false);
    }
  }, [draft, saving]);

  const noStall = error?.includes('No stall is linked') ?? false;

  return (
    <>
      <GlassHeader title="Pickup pin" fallbackHref="/(vendor)" />
      <Screen beneathHeader scrollable={false} contentStyle={styles.content}>
        <DeliveryMap
          points={points}
          route={null}
          fitToken={fitToken}
          pickMode={picking}
          locateControl
          onEvent={handleMapEvent}
          style={styles.map}
        />

        <View style={styles.footer}>
          {status === 'loading' ? (
            <SkeletonList rows={1} lines={2} thumb={0} label="Loading your stall" />
          ) : null}

          {status === 'error' && noStall ? (
            <EmptyState
              icon="storefront"
              title="No stall linked"
              message="This account is not linked to a stall yet. Ask your administrator to link one."
              actionTitle="Back to your stall"
              onAction={() => router.back()}
            />
          ) : null}

          {status === 'error' && !noStall ? (
            <ErrorState
              title="Couldn't load your stall"
              message={error ?? 'Check your connection and try again.'}
              retryTitle="Try again"
              onRetry={retry}
            />
          ) : null}

          {vendor && savedPin ? (
            <>
              <Text variant="secondary">Pickup pin saved for {vendor.name}.</Text>
              <Button title="Done" onPress={() => router.back()} />
            </>
          ) : null}

          {vendor && !savedPin && !picking && storedPin ? (
            <>
              <Text variant="secondary">
                Your stall&apos;s pickup pin is shown here. Helpers route to it, so if the counter
                moves, place it again.
              </Text>
              <Button title="Move pickup pin" variant="secondary" onPress={handleStartMove} />
            </>
          ) : null}

          {vendor && !savedPin && picking ? (
            <>
              <Text variant="secondary">
                {storedPin
                  ? `Tap where ${vendor.name} hands food over, then save it.`
                  : `Tap where ${vendor.name} hands food over. This is the point helpers navigate to.`}
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
                title="Save pickup pin"
                onPress={() => void handleSave()}
                disabled={!draft || saving}
                loading={saving}
              />
              {storedPin ? (
                <Button
                  title="Cancel"
                  variant="tertiary"
                  onPress={handleCancelMove}
                  disabled={saving}
                />
              ) : null}
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
