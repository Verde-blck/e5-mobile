import assert from 'node:assert/strict'
import vm from 'node:vm'
import { DEFAULT_MINT, mintTriplet, plexusHtml } from '@/shared/brand/plexus'
import { createRunner } from './harness'

const { t, report } = createRunner()

/** The page's script, taken out of the html. */
const scriptOf = (html: string) => html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'))

/** A stand-in browser: a canvas that counts what is drawn to it, a frame queue we drive by hand, and observers we can fire. */
function run(opts: { width: number; height: number; reduce?: boolean | null; html?: string; prefersReduced?: boolean }) {
  const calls = { arc: 0, stroke: 0, clear: 0, gradient: 0 }
  const strokes = new Set<string>()
  const ctx = {
    clearRect: () => void calls.clear++, beginPath() {}, moveTo() {}, lineTo() {}, fill() {}, setTransform() {},
    stroke: () => void calls.stroke++, arc: () => void calls.arc++, createRadialGradient: () => (calls.gradient++, { addColorStop() {} }),
    set strokeStyle(v: string) { strokes.add(v) }, set fillStyle(_v: unknown) {}, set lineWidth(_v: number) {},
  }
  const canvas = { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => ({ width: opts.width, height: opts.height }) }
  const frames: Array<(t: number) => void> = []
  let resize: () => void = () => {}
  let intersect: (e: Array<{ isIntersecting: boolean }>) => void = () => {}
  let clock = 0
  const sandbox: Record<string, unknown> = {
    document: { getElementById: () => canvas },
    window: { matchMedia: () => ({ matches: opts.prefersReduced === true }), devicePixelRatio: 2 },
    performance: { now: () => clock },
    requestAnimationFrame: (cb: (t: number) => void) => (frames.push(cb), frames.length),
    cancelAnimationFrame: () => { frames.length = 0 },
    ResizeObserver: class { constructor(cb: () => void) { resize = cb } observe() {} },
    IntersectionObserver: class { constructor(cb: typeof intersect) { intersect = cb } observe() {} },
    Math,
  }
  sandbox.window = Object.assign(sandbox.window as object, sandbox)
  vm.runInNewContext(scriptOf(opts.html ?? plexusHtml(DEFAULT_MINT, opts.reduce ?? null)), sandbox)
  const stats = () => (sandbox.window as { __plexus: { frames: number; nodes: number; reduced: boolean; mint: string } }).__plexus
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { clock += 16; const cb = frames.shift(); cb?.(clock) } }
  return { calls, strokes, stats, tick, frames, resize: () => resize(), intersect: (isIntersecting: boolean) => intersect([{ isIntersecting }]), canvas }
}

async function main() {
  await t('a colour becomes the rgba triplet; the web\'s mint is the default, and anything that isn\'t a colour falls back to it', () => {
    assert.equal(DEFAULT_MINT, '#A3E2D7'); assert.equal(mintTriplet('#A3E2D7'), '163, 226, 215'); assert.equal(mintTriplet('0b5cad'), '11, 92, 173'); assert.equal(mintTriplet(' #0B5CAD '), '11, 92, 173')
    for (const bad of ['', 'blue', '#12', '#GGGGGG', 'rgb(1,2,3)']) assert.equal(mintTriplet(bad), '163, 226, 215', bad)
  })
  await t('the page is one script, fully filled in, that is valid JavaScript, and a colour or flag can\'t break out of it', () => {
    const html = plexusHtml('#0B5CAD', true); assert.equal(html.split('<script>').length, 2); assert.equal(html.split('</script>').length, 2)
    assert.ok(!html.includes('__MINT__') && !html.includes('__REDUCE__'), 'nothing left to fill in'); assert.match(html, /var MINT = '11, 92, 173';/); assert.match(html, /var FORCED = true;/)
    assert.match(plexusHtml(DEFAULT_MINT, false), /var FORCED = false;/); assert.match(plexusHtml(DEFAULT_MINT), /var FORCED = null;/); assert.match(plexusHtml("'; alert(1); '"), /var MINT = '163, 226, 215';/, 'a hostile colour is just the default')
    assert.doesNotThrow(() => new vm.Script(scriptOf(html)))
  })
  await t('it is the web\'s animation, with the same numbers: 14 to 56 nodes by area, links over 92 px on a phone and 140 on a tablet, at most 4 packets, a capped step', () => {
    const s = scriptOf(plexusHtml())
    for (const same of ['Math.max(14, Math.min(56, Math.round(area / 9500)))', 'width < 640 ? 92 : 140', 'speed = 5 + Math.random() * 9', 'packets.length < 4', 'Math.random() < 0.02', 'Math.min((now - last) / 1000, 0.05)', 'closeness * closeness * 0.5', 'Math.min(window.devicePixelRatio || 1, 2)', 'dt / 1.6', 'time / 900'])
      assert.ok(s.includes(same), `keeps ${same}`)
  })
  await t('on a tablet panel it draws a network that moves: nodes are seeded to the area (capped at 56), frames keep coming, and each draws links and nodes', () => {
    const p = run({ width: 800, height: 700 }); assert.equal(p.stats().nodes, 56, '800 x 700 would be 59: capped at 56'); assert.equal(p.canvas.width, 1600, 'sharp: drawn at 2x'); assert.equal(p.frames.length, 1, 'a frame is waiting')
    p.tick(30); assert.equal(p.stats().frames, 30); assert.ok(p.calls.arc >= 30 * 56 * 2, 'every node, twice (halo and core), every frame'); assert.ok(p.calls.stroke > 30, 'and links between the nearby ones'); assert.ok(p.strokes.size > 5, 'whose strength varies with distance'); assert.ok([...p.strokes].every((s) => s.startsWith('rgba(163, 226, 215, ')), 'all in the mint')
  })
  await t('a phone-sized panel gets fewer nodes; a tiny one never fewer than 14', () => {
    assert.equal(run({ width: 390, height: 300 }).stats().nodes, 14, '117,000 / 9,500 is 12: raised to the minimum'); assert.equal(run({ width: 390, height: 700 }).stats().nodes, 29); assert.equal(run({ width: 40, height: 40 }).stats().nodes, 14)
  })
  await t('with reduced motion it draws ONE still frame and never moves: no frame is ever scheduled', () => {
    for (const [name, p] of [['asked by the device', run({ width: 800, height: 700, reduce: true })], ['asked by the browser', run({ width: 800, height: 700, reduce: null, prefersReduced: true })]] as const) {
      assert.equal(p.stats().reduced, true, name); assert.equal(p.frames.length, 0, `${name}: nothing scheduled`); assert.equal(p.calls.clear, 1, `${name}: one frame drawn`); assert.ok(p.calls.arc > 0, `${name}: and it has the network in it`)
      p.tick(10); assert.equal(p.stats().frames, 0, `${name}: still nothing`)
    }
    const motion = run({ width: 800, height: 700, reduce: false, prefersReduced: true }); assert.equal(motion.stats().reduced, false, 'the device\'s own answer wins over the browser\'s')
  })
  await t('it stops drawing when the panel is off screen and picks up again when it is back, without teleporting the nodes', () => {
    const p = run({ width: 800, height: 700 }); p.tick(5); const before = p.stats().frames
    p.intersect(false); assert.equal(p.frames.length, 0, 'no frame waiting while hidden'); p.tick(20); assert.equal(p.stats().frames, before, 'nothing drawn while hidden')
    p.intersect(true); assert.equal(p.frames.length, 1, 'resumed'); p.tick(5); assert.equal(p.stats().frames, before + 5)
  })
  await t('a resize stretches the network to the new size instead of reseeding it (no jump), and reseeds only if the area changes a lot', () => {
    const p = run({ width: 800, height: 700 }); p.tick(3); const n = p.stats().nodes
    p.canvas.getBoundingClientRect = () => ({ width: 840, height: 700 }); p.resize(); assert.equal(p.stats().nodes, n, 'a small change keeps the same nodes')
    p.canvas.getBoundingClientRect = () => ({ width: 400, height: 300 }); p.resize(); assert.ok(p.stats().nodes < n && p.stats().nodes >= 14, 'a big change reseeds to suit the new area')
  })
  await t('a colour for the nodes is used everywhere it draws', () => {
    const p = run({ width: 800, height: 700, html: plexusHtml('#0B5CAD', false) }); p.tick(10); assert.equal(p.stats().mint, '11, 92, 173'); assert.ok([...p.strokes].every((s) => s.startsWith('rgba(11, 92, 173, ')))
  })
}
main().then(report)
