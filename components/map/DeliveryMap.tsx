import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { MAP_HTML } from '@/lib/maps/mapHtml';
import { MAP_USER_AGENT, FOLLOW_PADDING_PX } from '@/lib/maps/config';
import type { LatLng, MapCommand, MapEvent, MapPoint, RouteResult } from '@/lib/maps/types';

export interface DeliveryMapProps {
  /** Logical points with real coordinates. Empty kinds are simply absent. */
  points: MapPoint[];
  /** Routed geometry, or null when there is nothing honest to draw. */
  route: RouteResult | null;
  /**
   * `follow` keeps the moving point centred until the user drags the map,
   * `none` leaves the camera entirely to the user.
   */
  camera?: 'follow' | 'none';
  /**
   * Bump to refit the camera to the current points. Screens bump it when the
   * destination changes or the user asks to recentre — never on every GPS fix.
   */
  fitToken?: number;
  /**
   * Pin-placement mode. While on, a map tap reports its real coordinate as a
   * `map-tap` event instead of only moving the camera. Screens turn it on for
   * the length of one placement task.
   */
  pickMode?: boolean;
  onEvent?: (event: MapEvent) => void;
  style?: StyleProp<ViewStyle>;
  /** Hide the built-in state overlay when the screen renders its own. */
  hideInternalState?: boolean;
}

/**
 * The one map surface both roles use.
 *
 * It owns the pieces that must never be duplicated or re-created: the WebView
 * and its single static document, the command channel, marker move-vs-create
 * decisions, and the map's own failure states. Role differences live in the
 * props each screen passes and in the UI around the map, not in a second map.
 *
 * Efficiency rules this component enforces:
 * - the HTML source is a module constant, so the map never remounts;
 * - a marker command is sent only when that marker's coordinate actually
 *   changed, so a GPS stream costs one message per real movement;
 * - `fit` is driven by `fitToken`, never by position updates, so the camera
 *   does not jump on every fix;
 * - a user drag flips following off until a screen explicitly asks again.
 */
function DeliveryMapImpl({
  points,
  route,
  camera = 'none',
  fitToken = 0,
  pickMode = false,
  onEvent,
  style,
  hideInternalState = false,
}: DeliveryMapProps) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<'library' | 'tiles' | null>(null);
  // Camera ownership is a fact about the last interaction, not something the
  // rendered output reads: it only decides whether the next marker update may
  // move the view. A ref keeps it out of the render cycle — a drag then does
  // not re-render the map, and an explicit refit can hand the camera back
  // without a state update cascading out of an effect.
  const userTookCamera = useRef(false);

  // Last coordinates handed to the map, so unchanged markers stay quiet.
  const sentPoints = useRef<Map<string, string>>(new Map());
  const sentRouteId = useRef<number | null>(null);

  const send = useCallback((command: MapCommand) => {
    // The trailing `true;` keeps Android from warning about a non-void result.
    webRef.current?.injectJavaScript(
      `window.Send2U && window.Send2U.handle(${JSON.stringify(command)}); true;`,
    );
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let payload: MapEvent;
      try {
        payload = JSON.parse(event.nativeEvent.data) as MapEvent;
      } catch {
        return;
      }
      switch (payload.type) {
        case 'ready':
          setReady(true);
          return;
        case 'library-failed':
          setFailed('library');
          break;
        case 'tiles-failed':
          setFailed('tiles');
          break;
        case 'manual-pan':
          // The camera is the user's until a screen asks for it back.
          userTookCamera.current = true;
          break;
        case 'map-tap':
          // Pin placement: the tapped coordinate goes to the screen, which is
          // the only party that knows what a pin means for its own task.
          break;
        default:
          break;
      }
      onEvent?.(payload);
    },
    [onEvent],
  );

  // Markers: create what is missing, move what moved, drop what is gone.
  useEffect(() => {
    if (!ready) return;
    const present = new Set<string>();
    for (const point of points) {
      present.add(point.key);
      const signature = `${point.coordinate.latitude.toFixed(6)},${point.coordinate.longitude.toFixed(6)},${point.accuracyMeters ?? ''}`;
      if (sentPoints.current.get(point.key) === signature) continue;
      sentPoints.current.set(point.key, signature);
      send({
        type: 'setPoint',
        point,
        follows: camera === 'follow' && !userTookCamera.current,
      });
    }
    for (const key of Array.from(sentPoints.current.keys())) {
      if (present.has(key)) continue;
      sentPoints.current.delete(key);
      send({ type: 'removePoint', key: key as MapPoint['key'] });
    }
  }, [points, ready, camera, send]);

  // Route: only redraw when the geometry instance changes.
  useEffect(() => {
    if (!ready) return;
    if (!route) {
      if (sentRouteId.current !== null) {
        sentRouteId.current = null;
        send({ type: 'clearRoute' });
      }
      return;
    }
    if (sentRouteId.current === route.receivedAt) return;
    sentRouteId.current = route.receivedAt;
    send({ type: 'setRoute', coordinates: route.coordinates });
  }, [route, ready, send]);

  // Pick mode is a fact about the screen's current task rather than a steady
  // state of the map, so the command is sent when it flips and once when the
  // page is ready — never on an unrelated re-render. Pin placement therefore
  // costs one message going in and one coming out, and the map itself never
  // remounts for it.
  useEffect(() => {
    if (!ready) return;
    send({ type: 'pickMode', enabled: pickMode });
  }, [pickMode, ready, send]);

  // Camera fit is explicit: a new fitToken is the only thing that refits.
  useEffect(() => {
    if (!ready) return;
    const coordinates: LatLng[] = points.map((point) => point.coordinate);
    if (coordinates.length === 0) return;
    userTookCamera.current = false;
    send({ type: 'fit', coordinates, paddingPx: FOLLOW_PADDING_PX });
    // Points are read at fit time on purpose: a later GPS fix must not refit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken, ready, send]);

  // Follow is a property of the camera, not of one marker update, so it needs
  // its own command: the page only pans with the moving point while
  // `followEnabled` is true, and it switches that off itself the moment the user
  // drags. Re-sending after a fit is deliberate — a Recentre (a new fitToken)
  // resets the manual-pan flag just above, and this is what hands the camera
  // back to the moving point afterwards.
  useEffect(() => {
    if (!ready) return;
    send({ type: 'follow', enabled: camera === 'follow' && !userTookCamera.current });
  }, [camera, fitToken, ready, send]);

  const source = useMemo(() => ({ html: MAP_HTML, baseUrl: 'about:blank' }), []);

  const blockNavigation = useCallback((request: { url: string }) => {
    // Attribution and other links must open outside the map, never replace it.
    if (/^https?:/i.test(request.url)) {
      void Linking.openURL(request.url).catch(() => {});
      return false;
    }
    return true;
  }, []);

  const unavailable = failed !== null;

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webRef}
        source={source}
        originWhitelist={['*']}
        applicationNameForUserAgent={MAP_USER_AGENT}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={blockNavigation}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        style={styles.web}
      />

      {!ready && !unavailable && !hideInternalState ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
          <Text variant="caption" color="secondary">
            Loading map
          </Text>
        </View>
      ) : null}

      {unavailable && !hideInternalState ? (
        <View style={styles.overlay}>
          <Text color="secondary" style={styles.stateText}>
            {failed === 'library' ? 'Map could not start.' : 'Map tiles are unavailable.'}
          </Text>
          <Text variant="caption" color="muted" style={styles.stateText}>
            {failed === 'library'
              ? 'The map library did not load. Check the connection and try again.'
              : 'OpenStreetMap tiles did not load. Check the connection and try again.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Memoised on purpose: a GPS tick re-renders the screen that owns the location,
 * and this must not walk the WebView props again unless something the map draws
 * actually changed.
 */
export const DeliveryMap = memo(DeliveryMapImpl);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radii.lg,
  },
  web: { flex: 1, backgroundColor: colors.surfaceSecondary },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  stateText: { textAlign: 'center' },
});
