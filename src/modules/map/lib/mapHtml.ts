import { LEAFLET_CSS, LEAFLET_JS } from '../leaflet.generated'

/**
 * Sent as the page's origin so the tile server can see who is asking. Public tile servers
 * refuse requests with no referrer, and a page loaded from a string has none.
 */
export const MAP_BASE_URL = 'https://helmet.e5energyng.com'

/** JSON that is safe to place inside an inline <script>. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

// Lagos, wide enough to see the region until the first helmets arrive.
const DEFAULT_CENTER: [number, number] = [6.4474, 3.4012]
const DEFAULT_ZOOM = 11

/**
 * The whole map as one self-contained page: Leaflet embedded, styles included, nothing loaded
 * except the map tiles. The app talks to it through two things only:
 *
 *   in:  window.__apply({ type: 'state' | 'fit', ... })
 *   out: {type: 'ready' | 'select' | 'deselect' | 'selectAlarm', id}
 *        posted to the React Native WebView, or to the parent window in the web preview.
 *
 * The same page runs in the Android WebView and in the browser preview, so what is checked in
 * one is what runs in the other.
 */
export function buildMapHtml(options: { tileUrl: string; attribution: string }): string {
  const config = safeJson({
    tileUrl: options.tileUrl,
    attribution: options.attribution,
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
  })

  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="referrer" content="origin">
<style>${LEAFLET_CSS}</style>
<style>
html,body,#map{height:100%;margin:0;padding:0;background:#E5E7EB;font-family:system-ui,-apple-system,Roboto,sans-serif}
.leaflet-control-attribution{font-size:10px;background:rgba(255,255,255,.85)!important}
.leaflet-bar a{width:40px;height:40px;line-height:40px;font-size:20px}
.hm{width:30px;height:30px;position:relative}
.hm i{position:absolute;left:5px;top:5px;width:20px;height:20px;border-radius:50%;box-sizing:border-box;border:3px solid #fff;background:#94A3B8;box-shadow:0 1px 4px rgba(0,0,0,.5);transition:transform .15s}
.hm.online i{background:#059669}
.hm.degraded i{background:#F59E0B}
.hm.offline i{background:#94A3B8}
.hm.sel i{transform:scale(1.4);border-color:#0C352F}
.hm.critical::before,.hm.warning::before{content:"";position:absolute;left:0;top:0;right:0;bottom:0;border-radius:50%;border:3px solid #DC2626}
.hm.warning::before{border-color:#D97706}
.hm.critical::before{animation:pulse 1.2s ease-out infinite}
.am{width:26px;height:26px;position:relative}
.am i{position:absolute;left:3px;top:2px;width:20px;height:20px;box-sizing:border-box;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;background:#DC2626;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.am.warning i{background:#D97706}
.am.critical i{animation:bob 1s ease-in-out infinite}
@keyframes bob{0%,100%{margin-top:0}50%{margin-top:-3px}}
@keyframes pulse{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.5);opacity:0}}
.leaflet-tooltip.nm{font:600 12px system-ui,Roboto,sans-serif;background:#0C352F;color:#fff;border:0;border-radius:6px;padding:3px 8px;box-shadow:none}
.leaflet-tooltip-right.nm::before{border-right-color:#0C352F}
</style>
</head>
<body>
<div id="map"></div>
<script>${LEAFLET_JS}</script>
<script>
(function () {
  var CFG = ${config};
  var map = L.map('map', { zoomControl: false, minZoom: 3, maxZoom: 19 }).setView(CFG.center, CFG.zoom);
  map.attributionControl.setPrefix(false);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer(CFG.tileUrl, { maxZoom: 19, attribution: CFG.attribution }).addTo(map);

  var circleLayer = L.layerGroup().addTo(map);
  var helmetLayer = L.layerGroup().addTo(map);
  var alarmLayer = L.layerGroup().addTo(map);
  var helmets = {};
  var alarms = {};
  var lastSelected = null;
  var fittedOnce = false;

  function emit(message) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    else window.parent.postMessage({ __e5map: message }, '*');
  }

  function helmetIcon(h, selected) {
    var cls = 'hm ' + h.presence + (selected ? ' sel' : '') + (h.alarm ? ' ' + h.alarm : '');
    return L.divIcon({ className: '', html: '<div class="' + cls + '"><i></i></div>', iconSize: [30, 30], iconAnchor: [15, 15] });
  }

  function alarmIcon(a) {
    return L.divIcon({ className: '', html: '<div class="am ' + a.severity + '"><i></i></div>', iconSize: [26, 26], iconAnchor: [13, 40] });
  }

  function applyHelmets(list, selectedId) {
    var seen = {};
    list.forEach(function (h) {
      seen[h.id] = true;
      var selected = h.id === selectedId;
      var at = [h.lat, h.lng];
      var rec = helmets[h.id];
      if (!rec) {
        var marker = L.marker(at, { keyboard: false, riseOnHover: true, title: h.name, alt: h.name }).addTo(helmetLayer);
        marker.on('click', function (e) { L.DomEvent.stopPropagation(e); emit({ type: 'select', id: h.id }); });
        rec = helmets[h.id] = { marker: marker, circle: null, key: '' };
      } else {
        rec.marker.setLatLng(at);
      }
      var key = [h.name, h.presence, selected, h.alarm].join('|');
      if (rec.key !== key) {
        rec.marker.options.title = h.name;
        rec.marker.options.alt = h.name;
        rec.marker.setIcon(helmetIcon(h, selected));
        rec.marker.unbindTooltip();
        if (selected) rec.marker.bindTooltip(h.name, { permanent: true, direction: 'right', offset: [14, 0], className: 'nm' });
        rec.key = key;
      }
      rec.marker.setZIndexOffset(selected ? 1000 : h.alarm ? 500 : 0);

      // The accuracy circle: always for an approximate position (it is the honest picture of
      // where the helmet could be), and for the selected helmet whatever its source.
      var wantCircle = h.accuracy > 0 && (h.approximate || selected);
      if (wantCircle) {
        var style = h.approximate
          ? { color: '#D97706', weight: 1.5, dashArray: '5 4', fillColor: '#F59E0B', fillOpacity: 0.12 }
          : { color: '#0A6659', weight: 1.5, fillColor: '#0A6659', fillOpacity: 0.1 };
        if (!rec.circle) rec.circle = L.circle(at, { radius: h.accuracy, interactive: false }).addTo(circleLayer);
        rec.circle.setLatLng(at); rec.circle.setRadius(h.accuracy); rec.circle.setStyle(style);
      } else if (rec.circle) {
        circleLayer.removeLayer(rec.circle); rec.circle = null;
      }
    });
    Object.keys(helmets).forEach(function (id) {
      if (seen[id]) return;
      helmetLayer.removeLayer(helmets[id].marker);
      if (helmets[id].circle) circleLayer.removeLayer(helmets[id].circle);
      delete helmets[id];
    });
  }

  function applyAlarms(list) {
    var seen = {};
    list.forEach(function (a) {
      seen[a.id] = true;
      var rec = alarms[a.id];
      if (!rec) {
        var marker = L.marker([a.lat, a.lng], { icon: alarmIcon(a), keyboard: false, zIndexOffset: 800, title: a.label + ' - ' + a.deviceName }).addTo(alarmLayer);
        marker.on('click', function (e) { L.DomEvent.stopPropagation(e); emit({ type: 'selectAlarm', id: a.id }); });
        alarms[a.id] = marker;
      } else {
        rec.setLatLng([a.lat, a.lng]);
      }
    });
    Object.keys(alarms).forEach(function (id) {
      if (!seen[id]) { alarmLayer.removeLayer(alarms[id]); delete alarms[id]; }
    });
  }

  function allPoints() {
    var pts = [];
    Object.keys(helmets).forEach(function (id) { pts.push(helmets[id].marker.getLatLng()); });
    Object.keys(alarms).forEach(function (id) { pts.push(alarms[id].getLatLng()); });
    return pts;
  }

  function fit() {
    var pts = allPoints();
    if (!pts.length) return;
    if (pts.length === 1) { map.setView(pts[0], 16); return; }
    map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 16 });
  }

  window.__apply = function (message) {
    if (message.type === 'state') {
      applyHelmets(message.helmets, message.selectedId);
      applyAlarms(message.alarms);
      if (!fittedOnce && (message.helmets.length || message.alarms.length)) { fittedOnce = true; fit(); }
      // Choosing a helmet from the list brings it into view; one already on screen isn't moved.
      if (message.selectedId && message.selectedId !== lastSelected && helmets[message.selectedId]) {
        var at = helmets[message.selectedId].marker.getLatLng();
        if (!map.getBounds().pad(-0.2).contains(at)) map.panTo(at, { animate: true });
      }
      lastSelected = message.selectedId;
    } else if (message.type === 'fit') {
      fit();
    }
  };

  map.on('click', function () { emit({ type: 'deselect' }); });
  emit({ type: 'ready' });
})();
</script>
</body></html>`
}
