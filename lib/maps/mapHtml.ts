import {
  FOLLOW_PADDING_PX,
  FOLLOW_ZOOM,
  LEAFLET_CSS_URL,
  LEAFLET_JS_URL,
  MARKER_DROPOFF_COLOR,
  MARKER_HELPER_COLOR,
  MARKER_LOCATE_COLOR,
  MARKER_VENDOR_COLOR,
  OSM_ATTRIBUTION,
  OSM_MAX_ZOOM,
  OSM_TILE_URL,
  ROUTE_CASING_COLOR,
  ROUTE_CASING_WIDTH,
  ROUTE_COLOR,
  ROUTE_WIDTH,
} from '@/lib/maps/config';

/**
 * The map document, built once and handed to the WebView as a static string.
 *
 * Static matters: a source object that changes identity makes React Native
 * remount the WebView, which throws away the tile cache, the Leaflet instance
 * and every marker on each render. One string means one map for the screen's
 * lifetime; all updates arrive as commands through `window.Send2U`.
 *
 * Provider isolation holds here too — the only provider names in this file are
 * imported from `config.ts`.
 *
 * Marker updates never rebuild the map: `setPoint` moves an existing marker
 * with `setLatLng`, so a 1Hz GPS stream costs one DOM position update rather
 * than a new marker, a new tile layer or a new camera position.
 *
 * Pick mode is the one thing that makes a tap an answer instead of camera
 * interaction: the host turns it on for the length of a pin-placement task and
 * the page reports the tapped coordinate back as `map-tap`.
 */

export function buildMapHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET_CSS_URL}" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #FFFFFF; }
  /* Restrained marker vocabulary: circles only, no artwork, no emoji. */
  .s2u-marker {
    width: 18px; height: 18px; border-radius: 50%;
    box-sizing: border-box;
    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
  }
  .s2u-marker-helper { width: 22px; height: 22px; }
  /* "You are here": a hollow ring with a filled centre, deliberately unlike the
     filled delivery pins so it can never be read as one. */
  .s2u-marker-locate { background: #FFFFFF; width: 20px; height: 20px; }
  .s2u-marker-locate::after {
    content: ''; position: absolute; left: 50%; top: 50%;
    width: 8px; height: 8px; margin: -4px 0 0 -4px;
    border-radius: 50%; background: ${MARKER_LOCATE_COLOR};
  }
  .s2u-marker-helper::after {
    content: ''; position: absolute; left: 50%; top: 50%;
    width: 6px; height: 6px; margin: -3px 0 0 -3px;
    border-radius: 50%; background: #FFFFFF;
    box-shadow: 0 0 0 2px ${MARKER_HELPER_COLOR};
  }
  /* Real GPS accuracy, drawn as reported. Never a decorative halo. */
  .s2u-accuracy {
    border-radius: 50%;
    background: ${MARKER_HELPER_COLOR};
    opacity: 0.12;
  }
  .leaflet-container { font-family: -apple-system, 'Roboto', 'Helvetica Neue', sans-serif; }
  .leaflet-control-attribution {
    background: rgba(255,255,255,0.86) !important;
    color: #5A4E52 !important;
    font-size: 10px !important;
    padding: 1px 5px !important;
  }
  .leaflet-control-attribution a { color: #5A4E52 !important; }
  #s2u-fallback {
    display: none; position: absolute; inset: 0; z-index: 900;
    align-items: center; justify-content: center; text-align: center;
    background: #F1ECEA; color: #5A4E52; font-size: 14px; padding: 24px;
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="s2u-fallback">Map unavailable</div>
<script src="${LEAFLET_JS_URL}"></script>
<script>
(function () {
  function send(event) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(event));
    } catch (e) { /* the host went away mid-flight */ }
  }

  if (typeof L === 'undefined') {
    document.getElementById('s2u-fallback').style.display = 'flex';
    send({ type: 'library-failed' });
    return;
  }

  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    // Nothing decorative: the base map is the only background.
    zoomSnap: 0.5,
    maxZoom: ${OSM_MAX_ZOOM},
  });
  map.setView([0, 0], 2);

  var tiles = L.tileLayer('${OSM_TILE_URL}', {
    maxZoom: ${OSM_MAX_ZOOM},
    attribution: '${OSM_ATTRIBUTION}',
    detectRetina: false,
  });

  // Three failed tiles in a row means the tile server is unreachable, not that
  // one tile is missing. That is a real error state for the UI, not a blank map.
  var tileErrors = 0;
  var tilesReported = false;
  tiles.on('tileerror', function () {
    tileErrors += 1;
    if (tileErrors >= 3 && !tilesReported) {
      tilesReported = true;
      send({ type: 'tiles-failed' });
    }
  });
  tiles.on('tileload', function () { tileErrors = 0; });
  tiles.addTo(map);

  var markers = {};
  // One style per logical point, from the provider config: the live helper is
  // brand red, the pickup is neutral dark, the drop-off is brand red as well.
  var MARKER_STYLES = {
    helper: 'background:${MARKER_HELPER_COLOR};border:3px solid #FFFFFF;',
    vendor: 'background:${MARKER_VENDOR_COLOR};border:3px solid #FFFFFF;',
    dropoff: 'background:${MARKER_DROPOFF_COLOR};border:3px solid #FFFFFF;',
    locate: 'background:#FFFFFF;border:3px solid ${MARKER_LOCATE_COLOR};',
  };
  var accuracyCircle = null;
  var routeCasing = null;
  var routeLine = null;
  var userControlsCamera = false;
  var followEnabled = false;
  // Centre reporting for fixed-pin screens: the next settled camera position
  // is an answer (the host asked for this jump), not exploration.
  var reportCenterOnMoveEnd = false;
  // Pin placement: while this is on, a plain map tap is a coordinate answer
  // rather than camera interaction, and it is reported to the host.
  var pickModeEnabled = false;

  function setPickMode(enabled) {
    pickModeEnabled = !!enabled;
    // The cursor is the whole affordance. No overlay, no hint marker and no
    // extra layer: the screen that asked for pick mode decides what the tapped
    // coordinate means and draws it through the normal marker channel.
    map.getContainer().style.cursor = pickModeEnabled ? 'crosshair' : '';
  }

  // Manual inspection is a first-class action: once the user drags or pinches,
  // the camera stops being driven for them until a screen asks for follow again.
  map.on('dragstart', function () {
    userControlsCamera = true;
    followEnabled = false;
    send({ type: 'manual-pan' });
  });
  map.on('zoomstart', function () {
    if (map._s2uZoomProgrammatic) { map._s2uZoomProgrammatic = false; return; }
    userControlsCamera = true;
    send({ type: 'manual-pan' });
  });

  // A settled camera is a coordinate answer when the user moved it
  // themselves, or when the host asked for the jump: fixed-pin screens read
  // the container centre as the selected point. Fits, the initial world view
  // and follow pans never report, so the host only hears real placements.
  map.on('moveend', function () {
    if (!userControlsCamera && !reportCenterOnMoveEnd) return;
    reportCenterOnMoveEnd = false;
    var center = map.getCenter();
    if (!center || !finite(center.lat) || !finite(center.lng)) return;
    send({
      type: 'center-changed',
      coordinate: { latitude: center.lat, longitude: center.lng },
    });
  });

  // Pick mode consumes plain map taps only. Leaflet's own click event carries
  // the coordinate it actually resolved under the finger — projected through
  // the same tile grid the markers are drawn on — so the reported point is the
  // real device coordinate of the tap and never a snap to anything else. Marker
  // taps do not bubble here, so inspecting an existing pin can never be
  // mistaken for choosing a new one.
  map.on('click', function (event) {
    if (!pickModeEnabled || !event.latlng) return;
    if (!finite(event.latlng.lat) || !finite(event.latlng.lng)) return;
    send({
      type: 'map-tap',
      coordinate: { latitude: event.latlng.lat, longitude: event.latlng.lng },
    });
  });

  function finite(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function validPoint(point) {
    return (
      point &&
      point.coordinate &&
      finite(point.coordinate.latitude) &&
      finite(point.coordinate.longitude) &&
      Math.abs(point.coordinate.latitude) <= 90 &&
      Math.abs(point.coordinate.longitude) <= 180
    );
  }

  function latLng(coordinate) {
    return [coordinate.latitude, coordinate.longitude];
  }

  function ensureMarker(point) {
    var key = point.key || point.kind;
    var existing = markers[key];
    if (existing) return existing;
    var icon = L.divIcon({
      className: '',
      html:
        '<div class="s2u-marker s2u-marker-' +
        key +
        '" style="' +
        (MARKER_STYLES[key] || MARKER_STYLES.dropoff) +
        '"></div>',
      iconSize: key === 'helper' ? [22, 22] : key === 'locate' ? [20, 20] : [18, 18],
      iconAnchor: key === 'helper' ? [11, 11] : key === 'locate' ? [10, 10] : [9, 9],
    });
    var marker = L.marker(latLng(point.coordinate), {
      icon: icon,
      // The live position sits above the fixed points, never hidden by them.
      zIndexOffset: key === 'helper' ? 1000 : key === 'locate' ? 600 : 0,
      keyboard: false,
      // A tap on a pin belongs to that pin and never reaches the map under it,
      // so placing a new pin cannot be triggered by inspecting a drawn one.
      bubblingMouseEvents: false,
    });
    marker.on('click', function () {
      send({ type: 'point-tap', key: key, label: point.label || '' });
    });
    marker.addTo(map);
    markers[key] = marker;
    return marker;
  }

  function moveMarker(marker, point) {
    marker.setLatLng(latLng(point.coordinate));
    marker.setZIndexOffset(point.key === 'helper' ? 1000 : point.key === 'locate' ? 600 : 0);
  }

  function drawRoute(coordinates) {
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (routeCasing) { map.removeLayer(routeCasing); routeCasing = null; }
    if (!coordinates || coordinates.length < 2) return;
    var path = [];
    for (var i = 0; i < coordinates.length; i += 1) {
      var pair = coordinates[i];
      if (!pair || pair.length < 2 || !finite(pair[0]) || !finite(pair[1])) continue;
      path.push([pair[1], pair[0]]);
    }
    if (path.length < 2) return;
    routeCasing = L.polyline(path, {
      color: '${ROUTE_CASING_COLOR}', weight: ${ROUTE_CASING_WIDTH}, opacity: 0.9, interactive: false,
    }).addTo(map);
    routeLine = L.polyline(path, {
      color: '${ROUTE_COLOR}', weight: ${ROUTE_WIDTH}, opacity: 0.95, interactive: false,
    }).addTo(map);
  }

  function fitPoints(coordinates, padding) {
    var points = [];
    for (var i = 0; i < coordinates.length; i += 1) {
      var item = coordinates[i];
      if (item && finite(item.latitude) && finite(item.longitude)) points.push(latLng(item));
    }
    if (points.length === 0) return;
    userControlsCamera = false;
    map._s2uZoomProgrammatic = true;
    if (points.length === 1) {
      map.setView(points[0], ${FOLLOW_ZOOM});
      return;
    }
    map.fitBounds(L.latLngBounds(points), {
      padding: [padding || ${FOLLOW_PADDING_PX}, padding || ${FOLLOW_PADDING_PX}],
      maxZoom: 17,
    });
  }

  function followMarker(marker) {
    if (!marker) return;
    map._s2uZoomProgrammatic = true;
    map.panTo(marker.getLatLng(), { animate: true, duration: 0.4 });
  }

  window.Send2U = {
    handle: function (command) {
      if (!command || typeof command.type !== 'string') return;
      switch (command.type) {
        case 'setPoint': {
          var point = command.point;
          if (!validPoint(point)) return;
          var marker = ensureMarker(point);
          moveMarker(marker, point);
          if (point.kind === 'helper') {
            if (point.accuracyMeters && point.accuracyMeters > 0) {
              var latlng = marker.getLatLng();
              if (!accuracyCircle) {
                accuracyCircle = L.circle(latlng, {
                  radius: point.accuracyMeters,
                  className: 's2u-accuracy',
                  stroke: false,
                  interactive: false,
                }).addTo(map);
              } else {
                accuracyCircle.setLatLng(latlng);
                accuracyCircle.setRadius(point.accuracyMeters);
              }
            } else if (accuracyCircle) {
              map.removeLayer(accuracyCircle);
              accuracyCircle = null;
            }
            if (command.follows && followEnabled && !userControlsCamera) followMarker(marker);
          }
          return;
        }
        case 'removePoint': {
          var gone = markers[command.key];
          if (gone) { map.removeLayer(gone); delete markers[command.key]; }
          if (command.key === 'helper' && accuracyCircle) {
            map.removeLayer(accuracyCircle);
            accuracyCircle = null;
          }
          return;
        }
        case 'setRoute':
          drawRoute(command.coordinates);
          return;
        case 'clearRoute':
          drawRoute(null);
          return;
        case 'fit':
          fitPoints(command.coordinates, command.paddingPx);
          return;
        case 'centerOn': {
          var target = command.coordinate;
          if (!target || !finite(target.latitude) || !finite(target.longitude)) return;
          // The user asked for this jump, so it is not a manual pan, and it must
          // not quietly switch following back on either. The settled position
          // reports back as the selected centre for fixed-pin screens.
          map._s2uZoomProgrammatic = true;
          reportCenterOnMoveEnd = true;
          map.setView(
            [target.latitude, target.longitude],
            command.zoom || ${FOLLOW_ZOOM},
            { animate: false },
          );
          return;
        }
        case 'follow':
          followEnabled = !!command.enabled;
          // Asking to follow is also a reset of manual exploration.
          if (followEnabled) userControlsCamera = false;
          return;
        case 'pickMode':
          setPickMode(command.enabled);
          return;
        default:
          return;
      }
    },
  };

  send({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

/** Built once at import: the WebView source must never change identity. */
export const MAP_HTML = buildMapHtml();
