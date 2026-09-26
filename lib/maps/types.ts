/**
 * Shared vocabulary for the delivery map: coordinates, logical points, route
 * results, and the command protocol between React Native and the map WebView.
 *
 * Deliberately provider-agnostic — nothing here names Leaflet, OSM or OSRM, so
 * the tracking hooks and screens stay readable if the provider changes.
 */

/** A real coordinate. Never constructed from a label or a guess. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** The logical points a delivery map can show. */
export type MapPointKind = 'helper' | 'vendor' | 'dropoff' | 'locate';

/**
 * One marker on the map. `key` is stable across updates so the map moves the
 * existing marker instead of rebuilding it.
 */
export interface MapPoint {
  kind: MapPointKind;
  key: MapPointKind;
  coordinate: LatLng;
  label: string;
  /**
   * Device-reported accuracy for the live helper point. Drawn as a real
   * accuracy circle when present; never invented when the fix omits it.
   */
  accuracyMeters?: number | null;
}

/** A routed path: GeoJSON `[longitude, latitude]` pairs, in order. */
export interface RouteResult {
  /** `[lng, lat]` pairs, straight from the routing provider. */
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  /** When this route was received, for staleness checks. */
  receivedAt: number;
}

/** What the routing layer can tell us, so the UI never guesses a reason. */
export type RouteFailureReason = 'no-route' | 'provider-unavailable' | 'network';

export class RouteError extends Error {
  readonly reason: RouteFailureReason;

  constructor(reason: RouteFailureReason, message: string) {
    super(message);
    this.name = 'RouteError';
    this.reason = reason;
  }
}

/** Commands React Native sends into the map WebView. */
export type MapCommand =
  | { type: 'setRoute'; coordinates: [number, number][] }
  | { type: 'clearRoute' }
  | { type: 'setPoint'; point: MapPoint; follows: boolean }
  | { type: 'removePoint'; key: MapPointKind }
  | { type: 'fit'; coordinates: LatLng[]; paddingPx: number }
  | { type: 'follow'; enabled: boolean }
  /** Jump straight to one point at a given zoom, with no animation. */
  | { type: 'centerOn'; coordinate: LatLng; zoom: number }
  /** Pin placement mode: a map tap reports the tapped coordinate. */
  | { type: 'pickMode'; enabled: boolean };

/** Events the map WebView reports back. */
export type MapEvent =
  | { type: 'ready' }
  | { type: 'library-failed' }
  | { type: 'tiles-failed' }
  /** A marker was tapped; the label is whatever the screen supplied. */
  | { type: 'point-tap'; key: string; label: string }
  /** In pick mode: the user tapped the map, with the real coordinate. */
  | { type: 'map-tap'; coordinate: LatLng }
  /** The user dragged or pinched: the camera must stop being driven for them. */
  | { type: 'manual-pan' };

/**
 * Helper GPS permission surface. `services-off` and `unavailable` are separate
 * because the fix differs: one is a device setting, the other is a wait.
 */
export type LocationPermissionState =
  | 'unknown'
  | 'not-requested'
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'services-off'
  | 'unavailable';

/** Everything the tracking UI needs to know about where the helper is. */
export interface HelperLocationState {
  permission: LocationPermissionState;
  /** Latest device fix, null until one arrives. */
  coordinate: LatLng | null;
  /** Device-reported accuracy in metres, null when the fix omits it. */
  accuracyMeters: number | null;
  /** Device clock time of the latest fix. */
  updatedAt: number | null;
  /** True while the first fix of a session is still pending. */
  waitingForFix: boolean;
}
