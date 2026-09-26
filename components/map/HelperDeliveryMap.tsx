import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { DeliveryMap } from '@/components/map/DeliveryMap';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useDeliveryRoute } from '@/hooks/useDeliveryRoute';
import { locationStateMessage, useHelperLocation } from '@/hooks/useHelperLocation';
import { useHelperPositionPublisher } from '@/hooks/useHelperPositionPublisher';
import {
  isComplete,
  isTrackingPhase,
  orderMapGeometry,
  routeDestinationKey,
} from '@/lib/maps/orderPoints';
import { formatRouteDistance, formatRouteDuration } from '@/lib/maps/osrm';
import type { MapEvent, MapPoint, RouteFailureReason } from '@/lib/maps/types';
import type { OrderWithDetails } from '@/types/domain';

/**
 * The helper's live delivery map.
 *
 * This is only the *helper* side of the shared map: `DeliveryMap` remains the
 * one map surface both roles draw on, and everything below is what the person
 * carrying the food needs on top of it — their own device fix, the route to
 * wherever they are driving right now, and one honest sentence about the state
 * of location sharing.
 *
 * Three rules shape the whole file:
 *
 * 1. Coordinates are never fabricated. Every marker is a real fix or a real
 *    stored pin; a pin that does not exist means that marker is absent and the
 *    screen says so instead of drawing a route to nowhere. Phase and
 *    destination come from `orderMapGeometry`, so no status or hardcoded leg
 *    can drift away from the lifecycle.
 * 2. The camera belongs to the helper. It follows only while the delivery is
 *    actually moving and only until a drag or pinch, and a single restrained
 *    "Recentre" hands it back when asked — never sooner.
 * 3. Location sharing is a visible, terminal-aware thing: it starts with the
 *    tracking phase, stops when the phase ends, and a terminal order clears
 *    the published position rather than leaving a stale helper on a
 *    requester's map.
 *
 * Efficiency: the GPS stream lives inside this component, so a 1Hz fix
 * re-renders the map and its caption — not the delivery screen. `DeliveryMap`
 * is memoised and receives only real changes (its points, the route instance,
 * the camera mode and the fit token), which is what keeps a fix costing one
 * marker move instead of a map redraw.
 */

/** Map height: the surface stays on screen while the stage details scroll. */
const MAP_HEIGHT = 280;

/** A publish older than this is no longer evidence that sharing is happening. */
const SHARING_FRESH_MS = 20_000;

/** How often the sharing line re-checks that age when no fix is arriving. */
const SHARING_TICK_MS = 5_000;

type NoticeTone = 'secondary' | 'muted' | 'error';

/**
 * "Sharing your location" is only shown while publishes are actually landing,
 * and it ages out on its own clock — a device that has gone quiet must not keep
 * claiming to be sharing. It owns that timer so the map above it never
 * re-renders for a status line.
 */
const SharingLine = memo(function SharingLine({
  lastPublishedAt,
  error,
}: {
  lastPublishedAt: number | null;
  error: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (lastPublishedAt === null) return;
    // The clock is state rather than a render-time read, so the line ages out
    // on its own even when no fix is arriving to re-render anything.
    const timer = setInterval(() => setNow(Date.now()), SHARING_TICK_MS);
    return () => clearInterval(timer);
  }, [lastPublishedAt]);

  if (error) {
    return (
      <Text variant="caption" color="error">
        {error}
      </Text>
    );
  }
  if (lastPublishedAt === null || now - lastPublishedAt >= SHARING_FRESH_MS) return null;
  return (
    <Text variant="caption" color="muted">
      Sharing your location with the requester
    </Text>
  );
});

/** A restrained inline action: caption-sized, primary, 48pt touch target. */
function NoticeAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <Text variant="caption" style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Plain language for a failed route lookup; a provider status is not copy. */
function routeFailureText(reason: RouteFailureReason | null): string {
  switch (reason) {
    case 'no-route':
      return 'No route to the destination was found.';
    case 'provider-unavailable':
      return 'The routing service is unavailable right now.';
    case 'network':
      return 'Could not reach the routing service.';
    default:
      return 'Could not load the route.';
  }
}

export interface HelperDeliveryMapProps {
  order: OrderWithDetails;
  style?: StyleProp<ViewStyle>;
}

function HelperDeliveryMapImpl({ order, style }: HelperDeliveryMapProps) {
  // The lifecycle decides everything here: which leg we are on, whether live
  // tracking belongs to this order at all, and whether it is over.
  const tracking = isTrackingPhase(order.status);
  const terminal = isComplete(order.status);
  const geometry = useMemo(() => orderMapGeometry(order), [order]);
  const destinationKey = routeDestinationKey(order);
  const destination = geometry.destination;

  const { permission, coordinate, accuracyMeters, waitingForFix, requestPermission, openSettings } =
    useHelperLocation({ enabled: tracking });

  const {
    route,
    status: routeStatus,
    reason: routeReason,
    retry: retryRoute,
  } = useDeliveryRoute({
    from: coordinate,
    to: destination?.coordinate ?? null,
    destinationKey,
    enabled: tracking,
  });

  // Publishing follows the phase, never the screen: while the delivery is
  // active the requester gets the helper's fixes, and a terminal order deletes
  // the row it left behind.
  const { lastPublishedAt, publishError } = useHelperPositionPublisher({
    orderId: order.id,
    helperId: order.helperId ?? '',
    coordinate,
    accuracyMeters,
    enabled: tracking && order.helperId !== null,
    terminal,
  });

  const [userExploring, setUserExploring] = useState(false);
  const [fitToken, setFitToken] = useState(0);

  // A new journey — the phase flipped, or the destination moved to a different
  // pin — earns one camera reset: the helper is driving somewhere else now and
  // should see it, not the leg they just finished. Adjusted during render
  // rather than in an effect so the reset lands in the same commit as the new
  // destination, the way this screen already handles a changing job id.
  const [fittedJourney, setFittedJourney] = useState(destinationKey);
  if (fittedJourney !== destinationKey) {
    setFittedJourney(destinationKey);
    setUserExploring(false);
    setFitToken((token) => token + 1);
  }

  // The map document can finish loading before the device reports its first
  // fix, in which case it framed only the fixed pins. One refit when that fix
  // arrives puts the helper on their own map — and nothing at all if they have
  // already taken the camera for themselves.
  const [framedFirstFix, setFramedFirstFix] = useState(false);
  if (coordinate && !framedFirstFix) {
    setFramedFirstFix(true);
    if (!userExploring) setFitToken((token) => token + 1);
  }

  // Only real coordinates become markers. `orderMapGeometry` already validated
  // the stored pins, and the helper point is the device's own fix.
  const points = useMemo<MapPoint[]>(() => {
    const next: MapPoint[] = [];
    if (geometry.vendor) {
      next.push({
        kind: 'vendor',
        key: 'vendor',
        coordinate: geometry.vendor,
        label: order.vendor.name,
      });
    }
    if (geometry.dropoff) {
      next.push({
        kind: 'dropoff',
        key: 'dropoff',
        coordinate: geometry.dropoff,
        label: order.location.name,
      });
    }
    if (coordinate) {
      next.push({
        kind: 'helper',
        key: 'helper',
        coordinate,
        label: 'Your location',
        accuracyMeters,
      });
    }
    return next;
  }, [
    accuracyMeters,
    coordinate,
    geometry.dropoff,
    geometry.vendor,
    order.location.name,
    order.vendor.name,
  ]);

  const handleEvent = useCallback((event: MapEvent) => {
    // A deliberate drag or pinch means the helper is reading the map, not
    // following it. Everything else the map reports is its own business.
    if (event.type === 'manual-pan') setUserExploring(true);
  }, []);

  const recentre = useCallback(() => {
    setUserExploring(false);
    setFitToken((token) => token + 1);
  }, []);

  // Nothing to navigate outside a tracking phase. The screen keeps this
  // mounted on a terminal order purely so the cleanup above can run once.
  if (!tracking) return null;

  const legText = route
    ? [formatRouteDistance(route.distanceMeters), formatRouteDuration(route.durationSeconds)]
        .filter((part) => part.length > 0)
        .join(' · ')
    : '';

  let noticeText = '';
  let noticeTone: NoticeTone = 'secondary';
  let noticeAction: { label: string; onPress: () => void } | null = null;

  if (!destination) {
    // Without the destination pin there is no route worth drawing; the honest
    // thing is one line saying which pin is missing.
    noticeText =
      geometry.phase === 'to-vendor'
        ? 'The vendor has not set a pickup point yet.'
        : 'The drop-off point has not been set yet.';
  } else if (route) {
    noticeText = legText
      ? `${legText} to ${destination.label}`
      : `Route to ${destination.label}`;
  } else if (routeStatus === 'error') {
    noticeText = routeFailureText(routeReason);
    noticeTone = 'error';
    noticeAction = { label: 'Retry', onPress: retryRoute };
  } else if (routeStatus === 'loading') {
    noticeText = 'Finding the route';
    noticeTone = 'muted';
  }

  // Permission is a first-class state, not a fallback: each one says what is
  // actually wrong and offers the one action that can fix it.
  let locationText = '';
  let locationTone: NoticeTone = 'secondary';
  let locationAction: { label: string; onPress: () => void } | null = null;

  switch (permission) {
    case 'not-requested':
    case 'denied':
      locationText = locationStateMessage(permission);
      locationAction = { label: 'Allow location', onPress: () => void requestPermission() };
      break;
    case 'blocked':
      locationText = locationStateMessage(permission);
      locationAction = { label: 'Open settings', onPress: () => void openSettings() };
      break;
    case 'services-off':
    case 'unavailable':
      locationText = locationStateMessage(permission);
      break;
    case 'granted':
      locationText = waitingForFix || !coordinate ? 'Waiting for your location' : '';
      locationTone = 'muted';
      break;
    default:
      locationText = locationStateMessage('unknown');
      locationTone = 'muted';
  }

  // Following is for a moving delivery with somewhere to be, and only while the
  // helper has not taken the camera. The map itself also stops following on the
  // first manual pan; this keeps the two in step.
  const following = !userExploring && coordinate !== null && destination !== null;

  return (
    <View style={[styles.container, style]}>
      <DeliveryMap
        points={points}
        route={route}
        camera={following ? 'follow' : 'none'}
        fitToken={fitToken}
        onEvent={handleEvent}
        style={styles.map}
      />

      <View style={styles.status}>
        {noticeText ? (
          <View style={styles.statusRow}>
            <Text variant="caption" color={noticeTone} style={styles.statusText}>
              {noticeText}
            </Text>
            {noticeAction ? <NoticeAction {...noticeAction} /> : null}
          </View>
        ) : null}

        {locationText ? (
          <View style={styles.statusRow}>
            <Text variant="caption" color={locationTone} style={styles.statusText}>
              {locationText}
            </Text>
            {locationAction ? <NoticeAction {...locationAction} /> : null}
          </View>
        ) : null}

        {userExploring ? (
          <View style={[styles.statusRow, styles.recentreRow]}>
            <NoticeAction label="Recentre" onPress={recentre} />
          </View>
        ) : null}

        <SharingLine lastPublishedAt={lastPublishedAt} error={publishError} />
      </View>
    </View>
  );
}

/**
 * Memoised so the delivery screen's own re-renders — a payment tick, a
 * realtime reload — do not walk the map props. Only a real change to the order
 * (or an explicit style) reaches the WebView.
 */
export const HelperDeliveryMap = memo(HelperDeliveryMapImpl);

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  // The map is the primary surface: hairline edge, no card, no shadow.
  map: { height: MAP_HEIGHT, borderWidth: 1, borderColor: colors.divider },
  status: { gap: spacing.xs },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  recentreRow: { justifyContent: 'flex-end' },
  statusText: { flex: 1 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionLabel: { color: colors.primary, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
