import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { DeliveryMap } from '@/components/map/DeliveryMap';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';
import { useDeliveryRoute } from '@/hooks/useDeliveryRoute';
import { orderMapGeometry } from '@/lib/maps/orderPoints';
import { formatRouteDistance, formatRouteDuration } from '@/lib/maps/osrm';
import type { MapEvent, MapPoint, RouteFailureReason } from '@/lib/maps/types';
import type { OrderWithDetails } from '@/types/domain';

/**
 * The helper's two-point overview map: vendor pickup + requester drop-off on
 * one surface, with the driving leg between them when both pins exist.
 *
 * This is the decision view's answer to "where is this job", and the reason
 * the helper no longer leaves the app for Google Maps to see the two points.
 * It is deliberately dumber than `HelperDeliveryMap`: no GPS, no watchers,
 * no publishing, no follow — pure pins, one route, one fit. Phase and
 * destination play no role here; both points always draw.
 *
 * The map bleeds edge to edge (negative margins against the screen's own
 * padding, square corners), so the two points get the full width.
 */

/** Matches the workspace map height so the two surfaces read as one. */
const OVERVIEW_MAP_HEIGHT = 280;

export interface JobOverviewMapProps {
  order: OrderWithDetails;
  style?: StyleProp<ViewStyle>;
}

/** Plain language for a failed route lookup; a provider status is not copy. */
function routeFailureText(reason: RouteFailureReason | null): string {
  switch (reason) {
    case 'no-route':
      return 'No driving route between the two points was found.';
    case 'provider-unavailable':
      return 'The routing service is unavailable right now.';
    case 'network':
      return 'Could not reach the routing service.';
    default:
      return 'Could not load the route.';
  }
}

function JobOverviewMapImpl({ order, style }: JobOverviewMapProps) {
  // Both pins, whatever the lifecycle phase: this map answers "where", and
  // the workspace map answers "where to next".
  const geometry = useMemo(() => orderMapGeometry(order), [order]);

  const pinKey = useMemo(() => {
    const key = (point: { latitude: number; longitude: number } | null) =>
      point ? `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}` : 'none';
    return `${key(geometry.vendor)}|${key(geometry.dropoff)}`;
  }, [geometry]);

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
    return next;
  }, [geometry, order.location.name, order.vendor.name]);

  // The driving leg, fetched once per pin set: with a static origin there is
  // no drift and no ageing, so the hook's recalculation gates stay quiet and
  // this costs exactly one provider call.
  const {
    route,
    status: routeStatus,
    reason: routeReason,
  } = useDeliveryRoute({
    from: geometry.vendor,
    to: geometry.dropoff,
    destinationKey: `overview:${pinKey}`,
    enabled: geometry.vendor !== null && geometry.dropoff !== null,
  });

  const [fitToken, setFitToken] = useState(0);

  // One camera reset per pin set, landed in the same commit as the new pins
  // (the HelperDeliveryMap pattern): a changed job must reframe.
  const [fittedPins, setFittedPins] = useState(pinKey);
  if (fittedPins !== pinKey) {
    setFittedPins(pinKey);
    setFitToken((token) => token + 1);
  }

  const handleEvent = useCallback((event: MapEvent) => {
    // The map document can finish loading with nothing framed yet: one refit
    // on ready puts both pins on screen from the start.
    if (event.type === 'ready') setFitToken((token) => token + 1);
  }, []);

  const recentre = useCallback(() => {
    setFitToken((token) => token + 1);
  }, []);

  // No pins anywhere: a world view would lie by framing nothing, so the map
  // stays unmounted behind one honest sentence instead.
  if (!geometry.vendor && !geometry.dropoff) {
    return (
      <Card style={styles.emptyCard}>
        <Text variant="secondary">No locations pinned yet</Text>
        <Text color="secondary">
          The pickup and drop-off points appear on the map once they are set.
        </Text>
      </Card>
    );
  }

  const legText = route
    ? [formatRouteDistance(route.distanceMeters), formatRouteDuration(route.durationSeconds)]
        .filter((part) => part.length > 0)
        .join(' · ')
    : '';

  let caption: string | null = null;
  let captionTone: 'secondary' | 'muted' | 'error' = 'secondary';
  if (!geometry.vendor) {
    caption = 'The vendor has not set a pickup point yet.';
  } else if (!geometry.dropoff) {
    caption = 'The drop-off point has not been set yet.';
  } else if (route) {
    caption = legText
      ? `${legText} from ${order.vendor.name} to ${order.location.name}`
      : `Route from ${order.vendor.name} to ${order.location.name}`;
  } else if (routeStatus === 'error') {
    caption = routeFailureText(routeReason);
    captionTone = 'error';
  } else if (routeStatus === 'loading') {
    caption = 'Finding the route';
    captionTone = 'muted';
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.bleed}>
        <DeliveryMap
          points={points}
          route={route}
          fitToken={fitToken}
          onEvent={handleEvent}
          controls
          onRecenter={recentre}
          style={styles.map}
        />
      </View>
      {caption ? (
        <View style={styles.captionRow}>
          <Text variant="caption" color={captionTone} style={styles.captionText}>
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Memoised so the job screen's own re-renders — realtime reloads, payment
 * ticks — do not walk the WebView props. Only a real change to the order
 * reaches the map.
 */
export const JobOverviewMap = memo(JobOverviewMapImpl);

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  // Full-bleed: the screen's own horizontal padding is cancelled here so the
  // two points get the whole width; square corners, no frame.
  bleed: { marginHorizontal: -spacing.xl },
  map: { height: OVERVIEW_MAP_HEIGHT, borderRadius: 0 },
  emptyCard: { gap: spacing.xs },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  captionText: { flex: 1 },
});
