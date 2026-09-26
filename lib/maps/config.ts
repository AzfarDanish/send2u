/**
 * Map and routing provider configuration, isolated from the tracking UI.
 *
 * Everything the app needs to know about *who* serves tiles and routes lives
 * here so no delivery screen ever names a provider: moving from the public OSM
 * tile server to a self-hosted raster source, or from the public OSRM demo
 * router to one we run, is a change to this file alone.
 *
 * OpenStreetMap tile usage rules this configuration respects:
 * - interactive use only. No bulk downloading, no prefetching of large areas,
 *   no offline tile packs.
 * - visible attribution. The Leaflet attribution control is left on and the
 *   text is never hidden behind another element.
 * - identifying requests. `TILE_USER_AGENT` is applied to the map WebView, so
 *   every tile request carries a real app identifier rather than a bare
 *   WebView string.
 * - normal browser caching. Tile requests go out as plain GETs and the WebView
 *   caches them like any other image; we add no cache-busting parameters.
 */

/** Raster tile template. `{z}/{x}/{y}` are substituted by the map library. */
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Required attribution text, rendered inside the map by the map library. */
export const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors';

/** OSM serves nothing useful past z19; asking for more returns grey tiles. */
export const OSM_MAX_ZOOM = 19;

/**
 * Applied to the map WebView as a user-agent suffix, so tile and route requests
 * are attributable to this app per the OSM tile usage policy.
 */
export const MAP_USER_AGENT = 'Send2U/1.0 (com.azfardanish.send2u; campus delivery)';

/**
 * OSRM routing endpoint. The public demo server is fine for development and
 * light campus traffic; a production deployment should point this at our own
 * OSRM instance, which needs no other change.
 */
export const OSRM_BASE_URL = 'https://router.project-osrm.org';

/** Map library, loaded inside the WebView. Pinned, not `latest`. */
export const LEAFLET_VERSION = '1.9.4';
export const LEAFLET_JS_URL = `https://cdn.jsdelivr.net/npm/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
export const LEAFLET_CSS_URL = `https://cdn.jsdelivr.net/npm/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;

/**
 * Route line: a white casing under a blue line. The casing is what keeps the
 * route readable where the OSM base map is already light, and neither colour
 * competes with the marker red.
 */
export const ROUTE_COLOR = '#1667D6';
export const ROUTE_CASING_COLOR = '#FFFFFF';
export const ROUTE_WIDTH = 5;
export const ROUTE_CASING_WIDTH = 9;

/** Brand red, reused for the live helper marker and the drop-off pin. */
export const MARKER_HELPER_COLOR = '#DA0A1B';
export const MARKER_VENDOR_COLOR = '#3A3235';
export const MARKER_DROPOFF_COLOR = '#DA0A1B';

/** Camera: keep the active point inside this many pixels of the map edge. */
export const FOLLOW_PADDING_PX = 96;

/** Zoom applied when following a single moving point. */
export const FOLLOW_ZOOM = 16;

/**
 * Zoom used when the user asks the map to jump to their own position. Closer
 * than follow zoom on purpose: the point of that action is to see the ground
 * you are standing on while placing a pin on it.
 */
export const LOCATE_ZOOM = 17;

/**
 * "You are here" marker. Dark slate rather than brand red or route blue, so it
 * cannot be mistaken for a delivery point or for the drawn route.
 */
export const MARKER_LOCATE_COLOR = '#1F2937';

/** How long a one-shot fix may take before the control reports failure. */
export const LOCATE_TIMEOUT_MS = 20000;
