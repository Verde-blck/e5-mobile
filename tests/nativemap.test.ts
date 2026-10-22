import assert from 'node:assert/strict'
import { cleanMapId } from '@/config/env'
import { COLOURS, accuracyStyle, chooseMapEngine, circleBounds, distanceMetres, draftStyle, edgePadding, fenceAt, fenceStyle, fitCoordinates, helmetLook, helmetZ, nearEdgeOrOff, trackFitPoints, withAlpha, withMinSpan } from '@/modules/map/lib/nativeMap'
import type { MapFence, MapHelmet, MapTrack } from '@/modules/map/types'
import { createRunner } from './harness'

const { t, report } = createRunner()
const fence = (over: Partial<MapFence>): MapFence => ({ id: 1, type: 'ROUND', behavior: 'FORBIDDEN_TO_LEAVE', active: true, center: { lat: 6.45, lng: 3.39 }, radiusMeters: 100, points: [], ...over }) as MapFence
const helmet = (over: Partial<MapHelmet> = {}): MapHelmet => ({ id: 'h', name: 'H', lat: 6.45, lng: 3.39, presence: 'online', approximate: false, alarm: null, ...over })
const span = (pts: { latitude: number; longitude: number }[]) => ({ lat: Math.max(...pts.map((p) => p.latitude)) - Math.min(...pts.map((p) => p.latitude)), lng: Math.max(...pts.map((p) => p.longitude)) - Math.min(...pts.map((p) => p.longitude)) })

async function main() {
  await t('the Google map is used only on an Android build with a Google key, and the OpenStreetMap map everywhere else, including when asked for', () => {
    assert.equal(chooseMapEngine({ platform: 'android', hasKey: true }), 'google')
    assert.equal(chooseMapEngine({ platform: 'android', hasKey: false }), 'leaflet', 'no key: never a blank map'); assert.equal(chooseMapEngine({ platform: 'web', hasKey: true }), 'leaflet', 'the browser preview'); assert.equal(chooseMapEngine({ platform: 'ios', hasKey: true }), 'leaflet')
    for (const back of ['osm', 'OSM', ' osm ', 'leaflet']) assert.equal(chooseMapEngine({ platform: 'android', hasKey: true, preference: back }), 'leaflet', `"${back}" is the way back`)
    for (const other of [undefined, '', 'google', 'nonsense']) assert.equal(chooseMapEngine({ platform: 'android', hasKey: true, preference: other }), 'google', `${other}`)
  })
  await t('a Map ID is hexadecimal and is trimmed, so a stray space at the end of a pasted setting can\'t make Google ignore it', () => {
    assert.equal(cleanMapId('0123456789abcdef01234567'), '0123456789abcdef01234567'); assert.equal(cleanMapId('  0123456789abcdef01234567 '), '0123456789abcdef01234567'); assert.equal(cleanMapId('\"0123456789ABCDEF\"'), '0123456789ABCDEF')
    for (const bad of [undefined, '', '   ', 'DEMO_MAP_ID', '123', 'not-a-map-id-at-all-xx', '0123456789abcdeg']) assert.equal(cleanMapId(bad), undefined, String(bad))
  })
  await t('fences are drawn as on the Leaflet map: work areas teal, no-entry zones amber, switched off ones grey, the selected one thicker, all fading while another is drawn', () => {
    const work = fenceStyle(fence({}), false, false), no = fenceStyle(fence({ behavior: 'NO_ENTRY' }), false, false), off = fenceStyle(fence({ active: false }), false, false)
    assert.deepEqual(work, { stroke: withAlpha(COLOURS.work, 0.9), fill: withAlpha(COLOURS.work, 0.1), width: 2 }); assert.equal(no.stroke, withAlpha(COLOURS.noEntry, 0.9)); assert.equal(no.fill, withAlpha(COLOURS.noEntry, 0.18), 'a no-entry zone is filled more strongly')
    assert.equal(off.stroke, withAlpha(COLOURS.inactive, 0.7)); assert.equal(off.width, 1.5); assert.equal(fenceStyle(fence({}), true, false).width, 4, 'selected'); const dim = fenceStyle(fence({}), false, true); assert.equal(dim.stroke, withAlpha(COLOURS.work, 0.4)); assert.equal(dim.fill, withAlpha(COLOURS.work, 0.05))
    assert.equal(withAlpha('#0A6659', 0.5), 'rgba(10, 102, 89, 0.5)')
  })
  await t('the fence being drawn is bold, in the same colours, and grey when switched off', () => {
    assert.deepEqual(draftStyle({ active: true, behavior: 'FORBIDDEN_TO_LEAVE' }), { colour: COLOURS.work, stroke: withAlpha(COLOURS.work, 1), fill: withAlpha(COLOURS.work, 0.18), width: 3 }); assert.equal(draftStyle({ active: true, behavior: 'NO_ENTRY' }).colour, COLOURS.noEntry); assert.equal(draftStyle({ active: false, behavior: 'NO_ENTRY' }).colour, COLOURS.inactive)
  })
  await t('a helmet gets an accuracy circle if its position is approximate (dashed amber) or it is selected (teal); never without an accuracy', () => {
    assert.equal(accuracyStyle({ accuracy: 80, approximate: false }, false), null, 'GPS and not selected: none'); assert.equal(accuracyStyle({ accuracy: undefined, approximate: true }, true), null); assert.equal(accuracyStyle({ accuracy: 0, approximate: true }, true), null)
    const approx = accuracyStyle({ accuracy: 300, approximate: true }, false)!; assert.deepEqual([approx.radius, approx.dash, approx.stroke], [300, [5, 4], withAlpha(COLOURS.warning, 1)]); const picked = accuracyStyle({ accuracy: 12, approximate: false }, true)!; assert.equal(picked.dash, undefined); assert.equal(picked.stroke, withAlpha(COLOURS.work, 1))
  })
  await t('a marker is redrawn only when its look changes (presence, selected, alarm), and the selected helmet sits on top, then one with an alarm', () => {
    assert.equal(helmetLook(helmet(), false), 'online|0|'); assert.notEqual(helmetLook(helmet(), true), helmetLook(helmet(), false)); assert.notEqual(helmetLook(helmet({ alarm: 'critical' }), false), helmetLook(helmet(), false)); assert.equal(helmetLook(helmet({ name: 'Other', lat: 1 }), false), helmetLook(helmet(), false), 'moving or renaming changes nothing visible')
    assert.deepEqual([helmetZ(helmet(), true), helmetZ(helmet({ alarm: 'warning' }), false), helmetZ(helmet(), false)], [1000, 500, 0])
  })
  await t('framing: one helmet is never zoomed in to a blur, and a few close together get a minimum frame of 160 m', () => {
    const one = withMinSpan([{ latitude: 6.45, longitude: 3.39 }]); assert.equal(one.length, 3); const s = span(one); assert.ok(s.lat * 111_320 >= 159 && s.lng * 111_320 * Math.cos(6.45 * Math.PI / 180) >= 159, 'at least 160 m each way')
    const wide = [{ latitude: 6.4, longitude: 3.3 }, { latitude: 6.5, longitude: 3.5 }]; assert.deepEqual(withMinSpan(wide), wide, 'a wide spread is left alone'); assert.deepEqual(withMinSpan([]), [])
    const tall = withMinSpan([{ latitude: 6.4, longitude: 3.39 }, { latitude: 6.5, longitude: 3.3901 }]); assert.equal(tall.length, 4, 'tall but narrow gets a minimum width')
  })
  await t('a circle is framed by its four extremes, the right size on the ground', () => {
    const [n, s, e, w] = circleBounds({ lat: 6.45, lng: 3.39 }, 500); assert.ok(Math.abs((n.latitude - s.latitude) * 111_320 - 1000) < 1, 'about 1 km tall'); assert.ok(Math.abs(distanceMetres({ lat: 6.45, lng: 3.39 }, { lat: e.latitude, lng: e.longitude }) - 500) < 1); assert.ok(Math.abs(distanceMetres({ lat: 6.45, lng: 3.39 }, { lat: w.latitude, lng: w.longitude }) - 500) < 1)
  })
  await t('a route is framed by its real runs, ignoring stray one or two point outliers (a fix from another continent must not make the route a dot)', () => {
    const real: Array<[number, number]> = [[6.45, 3.39], [6.451, 3.391], [6.452, 3.392], [6.453, 3.393]]
    const track: MapTrack = { segments: [[[48.85, 2.35]], real, [[48.86, 2.36], [48.87, 2.37]]], start: real[0], end: real[3] }
    const pts = trackFitPoints(track); assert.equal(pts.length, 4, 'only the real run'); assert.ok(pts.every((p) => p.latitude < 7)); assert.equal(trackFitPoints({ segments: [[[1, 1]], [[2, 2], [3, 3]]], start: null, end: null }).length, 2, 'no long run: the longest one'); assert.deepEqual(trackFitPoints(null), []); assert.deepEqual(trackFitPoints({ segments: [], start: null, end: null }), [])
  })
  await t('each screen frames what it should: helmets and alarms, the fence being drawn, the saved fences, or the route, with room left clear for the playback bar', () => {
    const f = [fence({ id: 1 }), fence({ id: 2, type: 'POLYGON', center: null, points: [{ lat: 6.4, lng: 3.3 }, { lat: 6.5, lng: 3.3 }, { lat: 6.5, lng: 3.4 }] })]
    assert.equal(fitCoordinates('all', { helmets: [helmet(), helmet({ id: 'b', lat: 6.5 })], alarms: [{ id: 'a', lat: 6.6, lng: 3.4, severity: 'critical', label: '', deviceName: '' }] }).length, 3)
    assert.equal(fitCoordinates('fences', { fences: f }).length, 4 + 3); assert.equal(fitCoordinates('draft', { draft: { ...f[0], type: 'ROUND' } as never }).length, 4); assert.deepEqual(fitCoordinates('draft', {}), []); assert.deepEqual(fitCoordinates('all', {}), [])
    assert.deepEqual(edgePadding('all'), { top: 60, right: 60, bottom: 60, left: 60 }); assert.deepEqual(edgePadding('track', 250), { top: 48, right: 48, bottom: 298, left: 48 })
  })
  await t('the map is moved to bring something back only when it is near the edge or off screen, so it does not jump while you watch', () => {
    const b = { northEast: { latitude: 7, longitude: 4 }, southWest: { latitude: 6, longitude: 3 } }
    assert.equal(nearEdgeOrOff({ latitude: 6.5, longitude: 3.5 }, b), false, 'the middle'); assert.equal(nearEdgeOrOff({ latitude: 6.95, longitude: 3.5 }, b), true, 'near the top edge'); assert.equal(nearEdgeOrOff({ latitude: 6.5, longitude: 3.05 }, b), true); assert.equal(nearEdgeOrOff({ latitude: 9, longitude: 9 }, b), true, 'off screen'); assert.equal(nearEdgeOrOff({ latitude: 6.5, longitude: 3.5 }, b, 0.6), true, 'a wide margin')
  })
  await t('a tap is matched to the fence it landed in, circle or polygon, with the top one winning where they overlap, and none outside', () => {
    const ring = fence({ id: 1, center: { lat: 6.45, lng: 3.39 }, radiusMeters: 200 }); const poly = fence({ id: 2, type: 'POLYGON', center: null, radiusMeters: 0, points: [{ lat: 6.45, lng: 3.39 }, { lat: 6.46, lng: 3.39 }, { lat: 6.46, lng: 3.40 }, { lat: 6.45, lng: 3.40 }] })
    assert.equal(fenceAt({ lat: 6.4505, lng: 3.39 }, [ring]), 1); assert.equal(fenceAt({ lat: 6.455, lng: 3.395 }, [ring, poly]), 2, 'inside the polygon only'); assert.equal(fenceAt({ lat: 6.4503, lng: 3.3902 }, [ring, poly]), 2, 'in both: the one drawn last'); assert.equal(fenceAt({ lat: 6.4503, lng: 3.3902 }, [poly, ring]), 1)
    assert.equal(fenceAt({ lat: 6.5, lng: 3.5 }, [ring, poly]), null); assert.equal(fenceAt({ lat: 6.455, lng: 3.395 }, [fence({ id: 3, type: 'POLYGON', center: null, points: [{ lat: 6.4, lng: 3.3 }, { lat: 6.5, lng: 3.3 }] })]), null, 'a polygon with under 3 corners is nothing'); assert.equal(fenceAt({ lat: 1, lng: 1 }, []), null)
    assert.ok(Math.abs(distanceMetres({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111_195) < 50, 'a degree of longitude at the equator')
  })
}
main().then(report)
