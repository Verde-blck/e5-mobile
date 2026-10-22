/*
 * The sign-in panel's animated network: drifting nodes, links that fade in with distance, packets of "data" travelling along live
 * links, and larger "helmet" nodes that pulse slowly. It is the web dashboard's PlexusField, ported as it is.
 *
 * A phone or tablet has no browser canvas, so this is a small web page that is drawn in a transparent web view on the tablet and
 * in an iframe in the browser preview. Both show exactly this page, so the preview is what the tablet draws.
 */

/** The E5 mint, as the web uses it. */
export const DEFAULT_MINT = '#A3E2D7'

/** "#A3E2D7" as the "163, 226, 215" that rgba() wants; the default mint for anything that isn't a colour. */
export function mintTriplet(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()) ?? /^#?([0-9a-f]{6})$/i.exec(DEFAULT_MINT)
  const value = m![1]
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)).join(', ')
}

const SCRIPT = `
(function () {
  var MINT = '__MINT__';
  var FORCED = __REDUCE__;
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduceMotion = FORCED === null ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : FORCED;
  var width = 0, height = 0, linkDistance = 120, nodes = [], seededArea = 0, packets = [], frame = 0, last = performance.now(), running = true;
  var stats = window.__plexus = { frames: 0, reduced: reduceMotion, mint: MINT, nodes: 0 };

  function seed() {
    var area = width * height;
    var count = Math.max(14, Math.min(56, Math.round(area / 9500)));
    linkDistance = width < 640 ? 92 : 140;
    nodes = [];
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 5 + Math.random() * 9; // px per second
      var helmet = i < Math.max(3, Math.round(count / 10));
      nodes.push({
        x: Math.random() * width, y: Math.random() * height,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        r: helmet ? 2.6 : 1.1 + Math.random() * 0.9,
        helmet: helmet, phase: Math.random() * Math.PI * 2
      });
    }
    packets.length = 0;
    seededArea = area;
    stats.nodes = nodes.length;
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var prevWidth = width, prevHeight = height;
    width = rect.width; height = rect.height;
    if (width === 0 || height === 0) return;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Reseed on first layout, or when the panel changes size enough that the node count would be wrong.
    var areaRatio = (width * height) / (seededArea || 1);
    if (nodes.length === 0 || prevWidth === 0 || prevHeight === 0 || areaRatio > 1.6 || areaRatio < 0.6) seed();
    else {
      // Stretch the existing field to the new size rather than reseeding, so a resize doesn't make the network jump.
      var sx = width / prevWidth, sy = height / prevHeight;
      for (var i = 0; i < nodes.length; i++) { nodes[i].x *= sx; nodes[i].y *= sy; }
      linkDistance = width < 640 ? 92 : 140;
    }
    if (reduceMotion) draw(0);
  }

  function step(dt) {
    var margin = 20;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < -margin) n.x = width + margin; else if (n.x > width + margin) n.x = -margin;
      if (n.y < -margin) n.y = height + margin; else if (n.y > height + margin) n.y = -margin;
    }
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    var maxSq = linkDistance * linkDistance;
    var links = [];

    // Lines first, so nodes sit on top of them.
    ctx.lineWidth = 0.8;
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var dSq = dx * dx + dy * dy;
        if (dSq > maxSq) continue;
        var closeness = 1 - Math.sqrt(dSq) / linkDistance;
        // Squared falloff: links fade in gently rather than popping.
        var alpha = closeness * closeness * 0.5;
        ctx.strokeStyle = 'rgba(' + MINT + ', ' + alpha + ')';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        links.push([i, j]);
      }
    }

    // Occasional packets of "data" travelling along a live link.
    if (!reduceMotion && packets.length < 4 && links.length > 0 && Math.random() < 0.02) {
      var pick = links[Math.floor(Math.random() * links.length)];
      packets.push(Math.random() < 0.5 ? { a: pick[0], b: pick[1], t: 0 } : { a: pick[1], b: pick[0], t: 0 });
    }
    for (var k = packets.length - 1; k >= 0; k--) {
      var pk = packets[k];
      var pa = nodes[pk.a], pb = nodes[pk.b];
      var pdx = pb.x - pa.x, pdy = pb.y - pa.y;
      // Drop a packet whose link has stretched past breaking point.
      if (pk.t >= 1 || pdx * pdx + pdy * pdy > maxSq) { packets.splice(k, 1); continue; }
      var x = pa.x + pdx * pk.t, y = pa.y + pdy * pk.t;
      var fade = Math.sin(pk.t * Math.PI);
      ctx.fillStyle = 'rgba(' + MINT + ', ' + (0.9 * fade) + ')';
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }

    // Nodes, with a soft halo; helmet nodes breathe slowly.
    for (var m = 0; m < nodes.length; m++) {
      var nd = nodes[m];
      var pulse = nd.helmet && !reduceMotion ? 0.5 + 0.5 * Math.sin(time / 900 + nd.phase) : 0.5;
      var halo = nd.helmet ? 9 + pulse * 6 : nd.r * 4;
      var glow = ctx.createRadialGradient(nd.x, nd.y, 0, nd.x, nd.y, halo);
      glow.addColorStop(0, 'rgba(' + MINT + ', ' + (nd.helmet ? 0.28 + pulse * 0.12 : 0.18) + ')');
      glow.addColorStop(1, 'rgba(' + MINT + ', 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(nd.x, nd.y, halo, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(' + MINT + ', ' + (nd.helmet ? 0.95 : 0.7) + ')';
      ctx.beginPath(); ctx.arc(nd.x, nd.y, nd.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function loop(now) {
    if (!running) return;
    // Cap the step so returning to a background tab doesn't teleport nodes.
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    for (var i = 0; i < packets.length; i++) packets[i].t += dt / 1.6;
    draw(now);
    stats.frames++;
    frame = requestAnimationFrame(loop);
  }

  new ResizeObserver(resize).observe(canvas);
  resize();

  // Stop drawing while the panel is off screen.
  new IntersectionObserver(function (entries) {
    if (reduceMotion) return;
    var entry = entries[0];
    if (entry.isIntersecting && !running) { running = true; last = performance.now(); frame = requestAnimationFrame(loop); }
    else if (!entry.isIntersecting && running) { running = false; cancelAnimationFrame(frame); }
  }).observe(canvas);

  if (!reduceMotion) frame = requestAnimationFrame(loop); else running = false;
})();
`

/**
 * The page. \`mint\` is the colour of the nodes and links. \`reduceMotion\` true or false is what the device says; leave it out and the
 * page asks the browser itself. With reduced motion, one still frame is drawn and nothing moves.
 */
export function plexusHtml(mint: string = DEFAULT_MINT, reduceMotion: boolean | null = null): string {
  const script = SCRIPT.replace('__MINT__', mintTriplet(mint)).replace('__REDUCE__', reduceMotion === null ? 'null' : reduceMotion ? 'true' : 'false')
  // The canvas fades in as the page loads, so the panel never flashes an empty frame.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta name="color-scheme" content="normal"><style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;opacity:0;animation:in .6s ease-out .05s forwards}@keyframes in{to{opacity:1}}</style></head><body><canvas id="c" aria-hidden="true"></canvas><script>${script}</script></body></html>`
}
