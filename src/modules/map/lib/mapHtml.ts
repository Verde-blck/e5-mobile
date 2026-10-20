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
.dh{width:30px;height:30px;position:relative}
.dh i{position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;box-sizing:border-box;border:3px solid #fff;background:#0A6659;box-shadow:0 1px 5px rgba(0,0,0,.55);color:#fff;font:700 11px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;cursor:grab}
.dh.no i{background:#D97706}
.pt{width:26px;height:26px;border-radius:50%;box-sizing:border-box;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);color:#fff;font:700 12px system-ui,sans-serif;display:flex;align-items:center;justify-content:center}
.cu{width:24px;height:24px;border-radius:50%;box-sizing:border-box;border:4px solid #fff;background:#F59E0B;box-shadow:0 0 0 2px #B45309,0 1px 5px rgba(0,0,0,.5)}
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
  var fenceLayer = L.layerGroup().addTo(map);
  var draftLayer = L.layerGroup().addTo(map);
  var trackLayer = L.layerGroup().addTo(map);
  var cursorMarker = null;
  var lastCursor = null;
  var lastTrack = null;
  var drawing = false;
  var fitInset = 0;        // pixels at the bottom covered by an overlay (the playback bar)
  var fitPending = false;  // a fit was just made: if the page then changes size, fit again
  var fitTimer = null;
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
        if (!rec.circle) rec.circle = L.circle(at, { radius: h.accuracy, interactive: false, className: 'acc' }).addTo(circleLayer);
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


  function fenceStyle(f, selected, dim) {
    if (!f.active) return { color: '#94A3B8', weight: 1.5, fillColor: '#94A3B8', fillOpacity: 0.06, opacity: 0.7 };
    var color = f.behavior === 'NO_ENTRY' ? '#D97706' : '#0A6659';
    return { color: color, weight: selected ? 4 : 2, fillColor: color, fillOpacity: dim ? 0.05 : (f.behavior === 'NO_ENTRY' ? 0.18 : 0.1), opacity: dim ? 0.4 : 0.9 };
  }

  // Saved fences: work areas in the brand teal, no-entry zones in amber (red stays for alarms).
  function applyFences(list, selectedId, dim) {
    fenceLayer.clearLayers();
    list.forEach(function (f) {
      var style = fenceStyle(f, f.id === selectedId, dim);
      style.className = 'fence';
      style.interactive = !dim;
      var shape = null;
      if (f.type === 'ROUND' && f.center) shape = L.circle([f.center.lat, f.center.lng], Object.assign({ radius: f.radiusMeters }, style));
      else if (f.type === 'POLYGON' && f.points.length >= 3) shape = L.polygon(f.points.map(function (p) { return [p.lat, p.lng]; }), style);
      if (!shape) return;
      shape.addTo(fenceLayer);
      if (!dim) shape.on('click', function (e) { L.DomEvent.stopPropagation(e); emit({ type: 'selectFence', id: f.id }); });
    });
  }

  function handleIcon(label, noEntry) {
    return L.divIcon({ className: '', html: '<div class="dh' + (noEntry ? ' no' : '') + '"><i>' + label + '</i></div>', iconSize: [30, 30], iconAnchor: [15, 15] });
  }

  // The fence being drawn: a handle to drag the circle, numbered corners to drag the polygon.
  // While it exists, tapping the map places things instead of deselecting.
  function applyDraft(d) {
    draftLayer.clearLayers();
    drawing = !!d;
    if (!d) return;
    var noEntry = d.behavior === 'NO_ENTRY';
    var color = noEntry ? '#D97706' : '#0A6659';
    var style = d.active ? { color: color, weight: 3, fillColor: color, fillOpacity: 0.18 } : { color: '#94A3B8', weight: 3, fillColor: '#94A3B8', fillOpacity: 0.08 };
    if (d.type === 'ROUND') {
      if (!d.center) return;
      var circle = L.circle([d.center.lat, d.center.lng], Object.assign({ radius: d.radiusMeters, interactive: false, className: 'draft' }, style)).addTo(draftLayer);
      var handle = L.marker([d.center.lat, d.center.lng], { draggable: true, icon: handleIcon('', noEntry), keyboard: false, title: 'Drag to move the circle' }).addTo(draftLayer);
      handle.on('drag', function (e) { circle.setLatLng(e.target.getLatLng()); });
      handle.on('dragend', function (e) { var ll = e.target.getLatLng(); emit({ type: 'draftCenter', lat: ll.lat, lng: ll.lng }); });
      return;
    }
    var pts = d.points.map(function (p) { return [p.lat, p.lng]; });
    var shape = null;
    if (pts.length >= 3) shape = L.polygon(pts, Object.assign({ interactive: false, className: 'draft' }, style)).addTo(draftLayer);
    else if (pts.length === 2) shape = L.polyline(pts, { color: color, weight: 3, dashArray: '6 6', interactive: false, className: 'draft' }).addTo(draftLayer);
    var markers = d.points.map(function (p, i) {
      var m = L.marker([p.lat, p.lng], { draggable: true, icon: handleIcon(String(i + 1), noEntry), keyboard: false, title: 'Corner ' + (i + 1) }).addTo(draftLayer);
      m.on('drag', function () { if (shape) shape.setLatLngs(markers.map(function (x) { return x.getLatLng(); })); });
      m.on('dragend', function () { emit({ type: 'draftPoints', points: markers.map(function (x) { var ll = x.getLatLng(); return { lat: ll.lat, lng: ll.lng }; }) }); });
      return m;
    });
  }

  function endIcon(letter, background) {
    return L.divIcon({ className: '', html: '<div class="pt" style="background:' + background + '">' + letter + '</div>', iconSize: [26, 26], iconAnchor: [13, 13] });
  }

  var cursorIcon = L.divIcon({ className: '', html: '<div class="cu"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });

  function applyCursor(at, follow) {
    lastCursor = at;
    if (!at) { if (cursorMarker) { trackLayer.removeLayer(cursorMarker); cursorMarker = null; } return; }
    if (!cursorMarker) cursorMarker = L.marker(at, { icon: cursorIcon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(trackLayer);
    else cursorMarker.setLatLng(at);
    // Keep the playback marker on screen without re-fitting the view.
    if (follow && !map.getBounds().pad(-0.1).contains(at)) map.panTo(at, { animate: true });
  }

  // A route, one line per continuous run: a single line across the whole track would join a coverage
  // gap, or a bad fix on another continent, with a straight line that never happened.
  function applyTrack(t, fitIt) {
    trackLayer.clearLayers();
    cursorMarker = null;
    lastTrack = t;
    if (!t) return;
    t.segments.forEach(function (seg) {
      if (seg.length > 1) L.polyline(seg, { color: '#0F766E', weight: 4, opacity: 0.85, interactive: false, className: 'route' }).addTo(trackLayer);
      else if (seg.length === 1) L.circleMarker(seg[0], { radius: 4, color: '#0F766E', weight: 2, fillOpacity: 1, interactive: false, className: 'route' }).addTo(trackLayer);
    });
    if (t.start) L.marker(t.start, { icon: endIcon('A', '#10B981'), interactive: false, keyboard: false }).addTo(trackLayer);
    if (t.end) L.marker(t.end, { icon: endIcon('B', '#EF4444'), interactive: false, keyboard: false }).addTo(trackLayer);
    if (lastCursor) applyCursor(lastCursor, false);
    if (fitIt) fitTrack();
  }

  // Fit every run of real length, but not stray one- or two-point outliers: with an out-of-region fix
  // in the history (a reading from another continent), fitting everything would zoom out to show two
  // continents and the real route would become a dot.
  function fitTrack() {
    if (!lastTrack || !lastTrack.segments.length) return;
    map.invalidateSize();   // measure the page as it is now, not as it was when it loaded
    var runs = lastTrack.segments.filter(function (seg) { return seg.length >= 3; });
    if (!runs.length) runs = [lastTrack.segments.reduce(function (best, seg) { return seg.length > best.length ? seg : best; }, lastTrack.segments[0])];
    var points = [];
    runs.forEach(function (seg) { points = points.concat(seg); });
    if (points.length === 1) map.setView(points[0], 17);
    else map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [48, 48], paddingBottomRight: [48, 48 + fitInset], maxZoom: 18 });
    // The layout often settles just after the first fit; fit again if the size changes, until the person touches the map.
    fitPending = true;
    clearTimeout(fitTimer);
    fitTimer = setTimeout(function () { fitPending = false; }, 2500);
  }
  map.on('resize', function () { if (fitPending) fitTrack(); });
  map.on('mousedown touchstart', function () { fitPending = false; });

  function fitLayer(layer) {
    var group = L.featureGroup(layer.getLayers());
    var bounds = group.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
  }

  function fitTo(target) {
    if (target === 'track') fitTrack();
    else if (target === 'draft') fitLayer(draftLayer);
    else if (target === 'fences') fitLayer(fenceLayer);
    else fit();
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
      if (typeof message.inset === 'number') fitInset = message.inset;
      fitTo(message.target || 'all');
    } else if (message.type === 'fences') {
      applyFences(message.fences, message.selectedId, message.dim);
    } else if (message.type === 'draft') {
      applyDraft(message.draft);
    } else if (message.type === 'track') {
      fitInset = typeof message.inset === 'number' ? message.inset : 0;
      applyTrack(message.track, message.fit);
    } else if (message.type === 'cursor') {
      applyCursor(message.at, true);
    }
  };

  map.on('click', function (e) {
    if (drawing) emit({ type: 'mapTap', lat: e.latlng.lat, lng: e.latlng.lng });
    else emit({ type: 'deselect' });
  });
  emit({ type: 'ready' });
})();
</script>
</body></html>`
}
