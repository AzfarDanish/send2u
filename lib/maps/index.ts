/**
 * The single map module.
 *
 * Everything map- or location-related is reached through here, or through one
 * of its files, so the app never grows a second map abstraction:
 *
 * - `config`   — tile/routing provider settings (the only place they are named)
 * - `types`    — coordinates, points, routes, permission and event vocabulary
 * - `geo`      — distance comparisons between real fixes
 * - `osrm`     — route lookup (geometry, distance, duration)
 * - `mapHtml`  — the in-app map document (Leaflet over OSM raster tiles)
 * - `external` — the pre-existing "open this label in the phone's maps app"
 *                handoff, kept for the history detail (the one screen that
 *                still jumps out); the job screen shows both points in-app.
 *
 * The in-app map and the external handoff were never meant to be two systems:
 * `external.ts` used to sit at `lib/maps.ts`, which cannot coexist with this
 * directory, so it moved here unchanged and its two call sites keep importing
 * the same path.
 */

export { openMapsLocation, mapsSearchUrl } from '@/lib/maps/external';

export {
  FOLLOW_PADDING_PX,
  FOLLOW_ZOOM,
  MAP_USER_AGENT,
  MAPTILER_ATTRIBUTION,
  MAPTILER_MAX_ZOOM,
  MAPTILER_STYLE_ID,
  MAPTILER_TILE_URL,
  MARKER_HELPER_COLOR,
  MARKER_VENDOR_COLOR,
  OSM_ATTRIBUTION,
  OSM_MAX_ZOOM,
  OSM_TILE_URL,
  OSRM_BASE_URL,
  ROUTE_CASING_COLOR,
  ROUTE_CASING_WIDTH,
  ROUTE_COLOR,
  ROUTE_WIDTH,
} from '@/lib/maps/config';

export { distanceMeters, isSamePoint, isValidLatLng } from '@/lib/maps/geo';

export { fetchRoute, formatRouteDistance, formatRouteDuration } from '@/lib/maps/osrm';

export type {
  HelperLocationState,
  LatLng,
  LocationPermissionState,
  MapCommand,
  MapEvent,
  MapPoint,
  MapPointKind,
  RouteFailureReason,
  RouteResult,
} from '@/lib/maps/types';

export { RouteError } from '@/lib/maps/types';
