import assert from 'node:assert/strict'
import { getMockFleet } from '@/modules/devices/api/devices.mock'
import { toDeviceView } from '@/modules/devices/lib/presence'
import { getMockAlarms } from '@/modules/alarms/api/alarms.mock'
import { toAlarm } from '@/modules/alarms/api/alarms.api'
import type { Alarm } from '@/modules/alarms/types'
import { buildMapAlarms, buildMapHelmets, countByPresence, hasPosition } from '@/modules/map/lib/mapData'
import { buildMapHtml, safeJson } from '@/modules/map/lib/mapHtml'
import { dispatchMapEvent, parseMapEvent, type MapEvent, type MapHandlers } from '@/modules/map/lib/mapEvents'
import { useSelectionStore } from '@/shared/store/selectionStore'
import { toMapDraft, toMapFence } from '@/modules/map/lib/mapData'
import { getMockFences } from '@/modules/fences/api/fences.mock'
import { createRunner } from './harness'

const { t, report } = createRunner()

const fleet = () => getMockFleet().map((d) => toDeviceView(d, Date.now()))
const alarm = (id: string, deviceId: string, code: string, resolved = false): Alarm =>
  toAlarm({ id: Number(id), deviceId, alarmType: code, latitude: '6.45', longitude: '3.40', occurredAt: new Date().toISOString(), resolved })

async function main() {
  await t('a usable position: finite, in range, and not 0,0 (a helmet with no fix would sit in the sea)', () => {
    assert.equal(hasPosition(6.4474, 3.4012), true); assert.equal(hasPosition(-33.92, 18.42), true)
    assert.equal(hasPosition(0, 3.4), true, 'the equator is a real place'); assert.equal(hasPosition(6.4, 0), true, 'so is the prime meridian')
    assert.equal(hasPosition(0, 0), false, 'null island')
    assert.equal(hasPosition(undefined, 3.4), false); assert.equal(hasPosition(6.4, undefined), false)
    assert.equal(hasPosition(NaN, 3.4), false); assert.equal(hasPosition(Infinity, 3.4), false)
    assert.equal(hasPosition(91, 3.4), false); assert.equal(hasPosition(6.4, 181), false)
  })

  await t('the sample fleet: helmets without a position are listed apart, not drawn at a guess', () => {
    const { placed, unplaced } = buildMapHelmets(fleet(), [])
    assert.equal(placed.length + unplaced.length, 8)
    assert.ok(unplaced.length >= 2, 'a helmet that never reported, and one with no coordinates')
    assert.ok(placed.every((h) => hasPosition(h.lat, h.lng)))
    assert.equal(new Set(placed.map((h) => `${h.lat},${h.lng}`)).size, placed.length, 'no two sample helmets sit on the same spot')
  })

  await t('position source: GPS is exact, mobile-network and Wi-Fi fixes are approximate (they get a circle)', () => {
    const byName = Object.fromEntries(buildMapHelmets(fleet(), []).placed.map((h) => [h.name, h]))
    assert.equal(byName['Test Helmet'].approximate, false); assert.equal(byName['Test Helmet'].accuracy, 2.6)
    assert.equal(byName['Rig Supervisor'].approximate, true); assert.equal(byName['Rig Supervisor'].accuracy, 640)
  })

  await t('a helmet with an unresolved alarm is flagged; critical outranks warning in either order; resolved is ignored', () => {
    const devices = fleet(); const id = devices[0].id
    const flag = (alarms: Alarm[]) => buildMapHelmets(devices, alarms).placed.find((h) => h.id === id)?.alarm
    assert.equal(flag([]), null)
    assert.equal(flag([alarm('1', id, '1')]), 'warning')
    assert.equal(flag([alarm('1', id, '1'), alarm('2', id, '7')]), 'critical')
    assert.equal(flag([alarm('2', id, '7'), alarm('1', id, '1')]), 'critical')
    assert.equal(flag([alarm('2', id, '7', true)]), null, 'a resolved SOS no longer rings the helmet')
  })

  await t('alarm pins: unresolved alarms that have a position, labelled', () => {
    const alarms = getMockAlarms().map(toAlarm)
    const pins = buildMapAlarms(alarms)
    assert.ok(pins.length >= 2 && pins.every((p) => hasPosition(p.lat, p.lng)))
    assert.ok(!pins.some((p) => p.id === '1002'), 'the no-movement alarm has no position, so no pin')
    assert.ok(!alarms.filter((a) => a.status === 'resolved').some((a) => pins.some((p) => p.id === a.id)), 'resolved alarms get no pin')
    assert.deepEqual(pins.find((p) => p.id === '1006')?.label, 'Fall or impact')
  })

  await t('filter chip counts add up', () => {
    const { placed } = buildMapHelmets(fleet(), []); const c = countByPresence(placed)
    assert.equal(c.all, placed.length); assert.equal(c.online + c.degraded + c.offline, c.all)
  })

  await t('the map page: Leaflet embedded, configured from env, nothing left unfilled', () => {
    const html = buildMapHtml({ tileUrl: 'https://tiles.example/{z}/{x}/{y}.png', attribution: '© Example maps' })
    assert.ok(html.length > 150_000, 'Leaflet is inlined, not fetched from a CDN')
    assert.ok(!/https?:\/\/[^"' ]*(unpkg|cdn)/i.test(html), 'no CDN dependency')
    assert.ok(html.includes('L.map(') && html.includes('window.__apply'))
    assert.ok(html.includes('https://tiles.example/{z}/{x}/{y}.png') && html.includes('© Example maps'))
    assert.ok(!html.includes('${'), 'no template placeholder left behind')
  })

  await t('the map page cannot be broken (or hijacked) by what is put in the config', () => {
    const evil = '</script><script>alert(1)</script>'
    const html = buildMapHtml({ tileUrl: 'https://x/{z}/{x}/{y}.png', attribution: evil })
    assert.ok(!html.includes(evil), 'a closing script tag in the attribution must not survive')
    assert.ok(html.includes('\\u003c/script'))
    assert.equal(safeJson({ a: '<b>\u2028' }), '{"a":"\\u003cb>\\u2028"}')
  })

  await t('events from the map page are validated before the app acts on them', () => {
    assert.deepEqual(parseMapEvent('{"type":"ready"}'), { type: 'ready' })
    assert.deepEqual(parseMapEvent({ type: 'deselect' }), { type: 'deselect' })
    assert.deepEqual(parseMapEvent('{"type":"select","id":"866652022956404"}'), { type: 'select', id: '866652022956404' })
    assert.deepEqual(parseMapEvent({ type: 'selectAlarm', id: '77' }), { type: 'selectAlarm', id: '77' })
    for (const bad of [null, undefined, 'nope', '{', 42, {}, { type: 'select' }, { type: 'select', id: 5 }, { type: 'select', id: '' }, { type: 'evil', id: '1' }])
      assert.equal(parseMapEvent(bad), null, JSON.stringify(bad))
  })

  await t('the page\'s drawing events are validated too: fence taps, map taps, dragged handles', () => {
    assert.deepEqual(parseMapEvent({ type: 'selectFence', id: 7 }), { type: 'selectFence', id: 7 })
    assert.deepEqual(parseMapEvent('{"type":"mapTap","lat":6.45,"lng":3.4}'), { type: 'mapTap', lat: 6.45, lng: 3.4 })
    assert.deepEqual(parseMapEvent({ type: 'draftCenter', lat: -33.9, lng: 18.4 }), { type: 'draftCenter', lat: -33.9, lng: 18.4 })
    assert.deepEqual(parseMapEvent({ type: 'draftPoints', points: [{ lat: 6.4, lng: 3.4 }, { lat: 6.5, lng: 3.5 }] }), { type: 'draftPoints', points: [{ lat: 6.4, lng: 3.4 }, { lat: 6.5, lng: 3.5 }] })
    for (const bad of [{ type: 'selectFence', id: '7' }, { type: 'selectFence', id: 1.5 }, { type: 'mapTap', lat: 91, lng: 3 }, { type: 'mapTap', lat: 6, lng: 181 }, { type: 'mapTap', lat: NaN, lng: 3 },
      { type: 'mapTap', lat: '6', lng: '3' }, { type: 'draftPoints', points: [{ lat: 6, lng: 3 }, { lat: 'x', lng: 3 }] }, { type: 'draftPoints', points: 'no' }, { type: 'draftPoints' }])
      assert.equal(parseMapEvent(bad), null, JSON.stringify(bad))
  })
  await t('each event reaches the right handler, and a screen that ignores an event is not an error', () => {
    const seen: string[] = []
    const h: MapHandlers = { onReady: () => seen.push('ready'), onSelectHelmet: (id) => seen.push('helmet:' + id), onSelectAlarm: (id) => seen.push('alarm:' + id), onSelectFence: (id) => seen.push('fence:' + id),
      onMapTap: (lat, lng) => seen.push(`tap:${lat},${lng}`), onDraftChange: (p) => seen.push('draft:' + JSON.stringify(p)) }
    const events: MapEvent[] = [{ type: 'ready' }, { type: 'select', id: 'h1' }, { type: 'deselect' }, { type: 'selectAlarm', id: 'a1' }, { type: 'selectFence', id: 3 }, { type: 'mapTap', lat: 1, lng: 2 }, { type: 'draftCenter', lat: 3, lng: 4 }, { type: 'draftPoints', points: [{ lat: 5, lng: 6 }] }]
    for (const e of events) dispatchMapEvent(e, h)
    assert.deepEqual(seen, ['ready', 'helmet:h1', 'helmet:null', 'alarm:a1', 'fence:3', 'tap:1,2', 'draft:{"center":{"lat":3,"lng":4}}', 'draft:{"points":[{"lat":5,"lng":6}]}'])
    dispatchMapEvent({ type: 'mapTap', lat: 1, lng: 2 }, {}); dispatchMapEvent({ type: 'selectFence', id: 1 }, {})
  })
  await t('the page knows every layer the app sends it, and tells fences, accuracy circles and routes apart by class', () => {
    const html = buildMapHtml({ tileUrl: 'https://t/{z}/{x}/{y}.png', attribution: 'x' })
    for (const needle of ["message.type === 'fences'", "message.type === 'draft'", "message.type === 'track'", "message.type === 'cursor'", "type: 'selectFence'", "type: 'mapTap'", "type: 'draftCenter'", "type: 'draftPoints'", "style.className = 'fence'", "className: 'acc'", "className: 'route'", "draggable: true", 'invalidateSize', 'paddingBottomRight'])
      assert.ok(html.includes(needle), needle)
  })
  await t('a fence reaches the map as just what it draws (no names or helmet lists), and a draft as its shape', async () => {
    const [fence] = await getMockFences(); const m = toMapFence(fence)
    assert.deepEqual(Object.keys(m).sort(), ['active', 'behavior', 'center', 'id', 'points', 'radiusMeters', 'type'])
    assert.deepEqual(Object.keys(toMapDraft({ ...fence })).sort(), ['active', 'behavior', 'center', 'points', 'radiusMeters', 'type'])
  })
  await t('a fence can be the open item, independently of helmets and alarms, and clear() forgets it too', () => {
    const s = useSelectionStore.getState(); assert.equal(s.fenceId, null)
    s.selectFence(4); s.selectHelmet('h'); assert.equal(useSelectionStore.getState().fenceId, 4); assert.equal(useSelectionStore.getState().helmetId, 'h')
    s.selectFence(null); assert.equal(useSelectionStore.getState().helmetId, 'h'); s.selectFence(2); s.clear(); assert.equal(useSelectionStore.getState().fenceId, null)
  })
}
main().then(report)
