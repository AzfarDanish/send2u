import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DeliveryMap } from '@/components/map/DeliveryMap';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useDeliveryPosition, type DeliveryPositionStatus } from '@/hooks/useDeliveryPosition';
import { useDeliveryRoute } from '@/hooks/useDeliveryRoute';
import {
  formatRouteDistance,
  formatRouteDuration,
  type MapEvent,
  type MapPoint,
  type RouteFailureReason,
} from '@/lib/maps';
import { orderMapGeometry, routeDestinationKey } from '@/lib/maps/orderPoints';
import { formatRelativeTime } from '@/lib/orders';
import type { OrderWithDetails } from '@/types/domain';

/**
 * The requester's tracking surface.
 *
 * A role-specific wrapper over the one shared map, not a second map: the
 * requester watches a delivery rather than driving it, so the camera is framed
 * once and then left alone, and the only position this file can ever draw is
 * the one the helper's device published to the database — the requester's
 * phone is never read and location permission is never requested here. Every
 * line below is derived from real hook output; where there is nothing true to
 * show, the surface says so instead of filling the gap with something plausible.
 */

/** The map is a surface the requester reads, not a thumbnail. */
const MAP_HEIGHT = 260;

/** Slow clock for age lines only — no polling, no network, no writes. */
const AGE_TICK_MS = 30_000;

interface TrackingLine {
  headline: string;
  detail: string | null;
  /** Headline colour: the words carry the meaning, colour only reinforces it. */
  tone: string;
}

interface TrackingInput {
  status: DeliveryPositionStatus;
  hasPosition: boolean;
  realtimeConnected: boolean;
  updatedAt: string | null;
  error: string | null;
  /** Past the handover the helper stops publishing, so silence there means ended. */
  sharingEnded: boolean;
}

/**
 * The one place the tracking states are ordered. Evaluated top to bottom, so
 * each screenful is the strongest statement that is actually true:
 *
 * 1. loading — nothing known yet;
 * 2. error — the last read failed (with or without a fix already drawn);
 * 3. none — the helper has never published a position for this order;
 * 4. paused — a fix exists but the realtime stream is down;
 * 5. stale — the stream is up but the fix is older than a minute;
 * 6. live — a recent fix on a connected stream.
 *
 * No branch invents a position, a distance or an arrival time.
 */
function trackingLine(input: TrackingInput): TrackingLine {
  const { status, hasPosition, realtimeConnected, updatedAt, error, sharingEnded } = input;

  if (status === 'loading' || status === 'idle') {
    return { headline: 'Loading the helper\u2019s location', detail: null, tone: colors.muted };
  }

  if (status === 'error') {
    // A fix already on the map is still real: report what changed rather than
    // claiming the location disappeared while the marker sits on screen.
    return hasPosition
      ? {
          headline: 'Position not updating',
          detail: 'We could not refresh the position. The map shows the last one we loaded.',
          tone: colors.warning,
        }
      : {
          headline: 'Location unavailable',
          detail: error ?? 'We could not load your helper\u2019s position.',
          tone: colors.error,
        };
  }

  if (!hasPosition) {
    return sharingEnded
      ? {
          headline: 'Location sharing ended',
          detail: 'Your helper is no longer sharing a position for this request.',
          tone: colors.secondary,
        }
      : {
          headline: 'Waiting for the helper to share their location',
          detail: 'Their position appears here as soon as their device starts sharing it.',
          tone: colors.secondary,
        };
  }

  const age = updatedAt ? formatRelativeTime(updatedAt) : null;

  if (!realtimeConnected) {
    // A dropped stream is a fault worth noticing, so it takes the warning tone
    // and names how old what is still on the map actually is.
    return {
      headline: 'Live updates paused',
      detail: `Showing the last position your helper shared${age ? ` \u2014 ${age}` : ''}. This resumes on its own.`,
      tone: colors.warning,
    };
  }

  if (status === 'stale') {
    // An ageing fix is a fact about the data rather than a failure, so the
    // line stays neutral and the age itself is the headline.
    return {
      headline: age ? `Last updated ${age}` : 'Not live right now',
      detail: 'Not live — this is the last position your helper shared.',
      tone: colors.secondary,
    };
  }

  return {
    headline: 'Live position',
    detail: 'Your helper\u2019s position updates here as they move.',
    tone: colors.info,
  };
}

/** Why directions are missing, said plainly; the reason comes from the hook. */
function routeFailureMessage(reason: RouteFailureReason | null): string {
  switch (reason) {
    case 'no-route':
      return 'No road route connects these points right now.';
    case 'network':
      return 'Could not reach the directions service.';
    default:
      return 'Directions are unavailable right now.';
  }
}

/**
 * Re-renders on a slow clock so an age line ("Last updated 4 min ago") cannot
 * go stale itself while the tracking state stays the same. It only re-reads a
 * timestamp already on screen.
 */
function useAgeTick(enabled: boolean): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setTick((value) => value + 1), AGE_TICK_MS);
    return () => clearInterval(timer);
  }, [enabled]);
}

export interface RequesterTrackingMapProps {
  order: OrderWithDetails;
}

export function RequesterTrackingMap({ order }: RequesterTrackingMapProps) {
  const geometry = useMemo(() => orderMapGeometry(order), [order]);

  // One read plus one realtime subscription for this order. Both are read-only
  // by construction: the requester never publishes a position.
  const {
    position,
    status: positionStatus,
    error: positionError,
    realtimeConnected,
    refresh,
  } = useDeliveryPosition(order.id);

  const {
    route,
    status: routeStatus,
    reason: routeReason,
    retry: retryRoute,
  } = useDeliveryRoute({
    from: position?.coordinate ?? null,
    to: geometry.destination?.coordinate ?? null,
    destinationKey: routeDestinationKey(order),
  });

  const points = useMemo(() => {
    const next: MapPoint[] = [];
    if (position) {
      next.push({
        kind: 'helper',
        key: 'helper',
        coordinate: position.coordinate,
        label: 'Your helper',
        accuracyMeters: position.accuracyMeters,
      });
    }
    // The stall is the destination before pickup and the origin of the trip
    // after it, so it earns a marker whenever the vendor has set a pin.
    if (geometry.vendor) {
      next.push({
        kind: 'vendor',
        key: 'vendor',
        coordinate: geometry.vendor,
        label: `${order.vendor.name} (pickup)`,
      });
    }
    // The drop-off exists only once that location has real coordinates.
    if (geometry.dropoff) {
      next.push({
        kind: 'dropoff',
        key: 'dropoff',
        coordinate: geometry.dropoff,
        label: `${order.location.name} (drop-off)`,
      });
    }
    return next;
  }, [position, geometry, order.vendor.name, order.location.name]);

  const [fitStage, setFitStage] = useState(0);
  const [userPanned, setUserPanned] = useState(false);

  // The camera is framed once per picture, never per fix. It fits when there is
  // anything real to frame, and once more if the helper's first fix arrives
  // after we only had the fixed pins — unless the requester already panned,
  // because their camera is theirs. Later fixes only move the marker.
  const frameSettled = positionStatus !== 'loading' && positionStatus !== 'idle';
  if (points.length > 0 && frameSettled && fitStage === 0) setFitStage(1);
  if (fitStage === 1 && position !== null && !userPanned) setFitStage(2);

  const handleMapEvent = useCallback((event: MapEvent) => {
    if (event.type === 'manual-pan') setUserPanned(true);
  }, []);

  // After the handover the helper's row is removed, so a missing position then
  // means sharing ended rather than that they are about to start.
  const sharingEnded =
    order.status === 'delivered' ||
    order.status === 'awaiting_requester_payment' ||
    order.deliveredAt !== null;

  const line = trackingLine({
    status: positionStatus,
    hasPosition: position !== null,
    realtimeConnected,
    updatedAt: position?.updatedAt ?? null,
    error: positionError,
    sharingEnded,
  });

  const estimate = useMemo(() => {
    // Only a route the hook currently stands behind is quoted; a route kept on
    // screen through an outage is not a distance the requester can rely on.
    if (!route || routeStatus !== 'ready') return null;
    const parts: string[] = [];
    const distance = formatRouteDistance(route.distanceMeters);
    const duration = formatRouteDuration(route.durationSeconds);
    if (distance) parts.push(distance);
    if (duration) parts.push(`${duration} by road`);
    return parts.length > 0 ? `About ${parts.join(' \u00b7 ')} (estimate)` : null;
  }, [route, routeStatus]);

  const routeFailure =
    routeStatus === 'error'
      ? `${routeFailureMessage(routeReason)}${
          route ? ' The map keeps the last route it loaded.' : ''
        }`
      : null;

  // One retry at a time, in order of what is missing: the position first, then
  // directions. Two "Try again" buttons would be the same button twice.
  const retry =
    positionStatus === 'error'
      ? {
          title: 'Try again',
          onPress: () => {
            void refresh();
          },
        }
      : routeStatus === 'error'
        ? { title: 'Try again', onPress: retryRoute }
        : null;

  // Nothing to draw means no map: an empty world view would read as a broken
  // surface when the honest answer is that no pin is known yet.
  const loading = positionStatus === 'loading' || positionStatus === 'idle';
  const showMap = !loading && points.length > 0;

  useAgeTick(position !== null && (positionStatus === 'stale' || !realtimeConnected));

  return (
    <View style={styles.section}>
      <Text variant="subtitle">Tracking</Text>

      {loading ? (
        <Skeleton height={MAP_HEIGHT} radius={radii.lg} label={'Loading the helper\u2019s location'} />
      ) : null}

      {showMap ? (
        <DeliveryMap
          points={points}
          route={route}
          camera="none"
          fitToken={fitStage}
          onEvent={handleMapEvent}
          style={styles.map}
        />
      ) : null}

      <View style={styles.captions}>
        <Text variant="secondary" style={[styles.headline, { color: line.tone }]}>
          {line.headline}
        </Text>

        {line.detail ? (
          <Text variant="caption" color="secondary">
            {line.detail}
          </Text>
        ) : null}

        {estimate ? (
          <Text variant="caption" color="secondary">
            {estimate}
          </Text>
        ) : null}

        {routeFailure ? (
          <Text variant="caption" color="secondary">
            {routeFailure}
          </Text>
        ) : null}

        {geometry.destination ? null : (
          <Text variant="caption" color="muted">
            {geometry.phase === 'to-vendor'
              ? 'The stall has not set a pickup pin yet, so there is no route to draw.'
              : 'This request has no drop-off pin yet, so there is no route to draw.'}
          </Text>
        )}

        {retry ? <Button title={retry.title} variant="tertiary" onPress={retry.onPress} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // No card chrome: the map is a surface of its own and everything below it is
  // caption text, so this group carries spacing only.
  section: { gap: spacing.md },
  map: { height: MAP_HEIGHT },
  captions: { gap: spacing.sm },
  headline: { fontWeight: '600' },
});
