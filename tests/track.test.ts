import assert from 'node:assert/strict'
import { AxiosError } from 'axios'
import type { TelemetrySample } from '@/modules/devices/types'
import { MAX_PAGES, fetchTrackSamples } from '@/modules/track/api/track.api'
import { getMockTrackSamples } from '@/modules/track/api/track.mock'
import { buildAvailability, formatUptime } from '@/modules/track/lib/availability'
import { buildTrack, formatDistance, formatDuration, haversine, isApproximate, segmentsOf, trackToCsv } from '@/modules/track/lib/track'
import { PRESETS, localDay, parseDay, presetDates, rangeFromDates } from '@/modules/track/lib/range'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const MIN = 60_000
const T0 = Date.parse('2026-10-19T08:00:00+01:00')
const at = (min: number, lat: number, lng: number, extra: Partial<TelemetrySample> = {}): TelemetrySample => ({ ts: T0 + min * MIN, lat, lng, ...extra })
const build = (s: TelemetrySample[], opts?: { includeApproximate?: boolean }) => buildTrack('dev', s, T0 - MIN, T0 + 24 * 60 * MIN, false, opts)
const M = 1 / 111_195

async function main() {
  await t('haversine: a degree of latitude is about 111 km, zero between identical points', () => {
    assert.ok(Math.abs(haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111_195) < 300); assert.equal(haversine({ lat: 6.5, lng: 3.4 }, { lat: 6.5, lng: 3.4 }), 0)
  })

  await t('GPS noise: a helmet standing still doesn\'t "walk" (under 3 m between fixes counts as none)', () => {
    const s = Array.from({ length: 60 }, (_, i) => at(i, 6.5 + (i % 2) * 2 * M, 3.4))
    const track = build(s); assert.equal(track.stats.distanceMetres, 0); assert.equal(track.stats.movingMs, 0); assert.equal(track.stats.segments, 1)
  })
  await t('a real walk: distance, moving time and top speed add up', () => {
    const track = build([at(0, 6.5, 3.4), at(1, 6.5 + 60 * M, 3.4), at(2, 6.5 + 120 * M, 3.4), at(3, 6.5 + 120 * M, 3.4)])
    assert.ok(Math.abs(track.stats.distanceMetres - 120) < 1); assert.equal(track.stats.movingMs, 2 * MIN); assert.ok(Math.abs(track.stats.maxSpeedMps - 1) < 0.01)
    assert.equal(track.stats.durationMs, 3 * MIN); assert.deepEqual(track.points.map((p) => p.segment), [0, 0, 0, 0])
  })
  await t('a coverage gap over 5 min starts a new segment and adds no distance (no line through a building)', () => {
    const track = build([at(0, 6.5, 3.4), at(1, 6.5 + 60 * M, 3.4), at(11, 6.5 + 600 * M, 3.4), at(12, 6.5 + 660 * M, 3.4)])
    assert.equal(track.stats.segments, 2); assert.equal(track.stats.longestGapMs, 10 * MIN)
    assert.ok(Math.abs(track.stats.distanceMetres - 120) < 1, 'only the two real legs count: ' + track.stats.distanceMetres)
    assert.equal(segmentsOf(track.points).length, 2)
  })
  await t('an impossible jump (faster than 40 m/s, e.g. test data from China) is rejected, breaks the line, adds nothing', () => {
    const track = build([at(0, 6.5, 3.4), at(1, 6.5 + 60 * M, 3.4), at(2, 27.6, 112.9), at(3, 6.5 + 120 * M, 3.4)])
    assert.equal(track.stats.impossibleJumps, 2, 'out to Hunan and back are both impossible legs'); assert.equal(track.stats.segments, 3)
    assert.ok(track.stats.distanceMetres < 70, 'not eleven thousand kilometres: ' + track.stats.distanceMetres)
    assert.equal(track.stats.longestGapMs, 0, 'a jump is not a gap')
  })
  await t('two fixes with the same timestamp are a jump, not a division by zero', () => {
    const track = build([at(0, 6.5, 3.4), at(0, 6.5 + 50 * M, 3.4)]); assert.equal(track.stats.impossibleJumps, 1); assert.ok(Number.isFinite(track.stats.maxSpeedMps))
  })
  await t('fixes outside the range or with no position are ignored; unsorted input is sorted', () => {
    const track = buildTrack('dev', [at(5, 6.5, 3.4), { ts: T0 + MIN }, at(1, 6.5, 3.4), at(500, 6.5, 3.4)], T0, T0 + 10 * MIN, true)
    assert.deepEqual(track.points.map((p) => p.ts), [T0 + MIN, T0 + 5 * MIN]); assert.equal(track.truncated, true)
  })

  await t('indoor "network" and "wifi" positions are left out by default (they can be hundreds of metres off), and counted', () => {
    const walk = [at(0, 6.5, 3.4, { fixType: 'gps' }), at(1, 6.5 + 60 * M, 3.4, { fixType: 'gps' }), at(2, 6.5 + 400 * M, 3.4, { fixType: 'network', accuracyMeters: 300 }), at(3, 6.5 + 120 * M, 3.4, { fixType: 'gps' })]
    const lean = build(walk), all = build(walk, { includeApproximate: true })
    assert.equal(lean.points.length, 3); assert.equal(lean.stats.approximateExcluded, 1); assert.ok(lean.stats.distanceMetres < 125)
    assert.equal(all.points.length, 4); assert.equal(all.stats.approximateExcluded, 0); assert.ok(all.stats.distanceMetres > lean.stats.distanceMetres, 'including them adds distance the helmet never walked')
    assert.deepEqual(all.points.map((p) => p.approximate), [false, false, true, false])
  })
  await t('older rows have no fix type and count as GPS, as before', () => {
    assert.equal(isApproximate({}), false); assert.equal(isApproximate({ fixType: 'gps' }), false)
    for (const f of ['network', 'wifi', 'other'] as const) assert.equal(isApproximate({ fixType: f }), true, f)
    assert.equal(build([at(0, 6.5, 3.4), at(1, 6.5 + 60 * M, 3.4)]).stats.approximateExcluded, 0)
  })

  await t('formatting and CSV (quoted names, a position-source column)', () => {
    assert.equal(formatDistance(850), '850 m'); assert.equal(formatDistance(1500), '1.50 km'); assert.equal(formatDuration(30 * MIN), '30 min'); assert.equal(formatDuration(125 * MIN), '2h 5m'); assert.equal(formatDuration(120 * MIN), '2h')
    const csv = trackToCsv(build([at(0, 6.5, 3.4, { fixType: 'gps' }), at(1, 6.5 + 60 * M, 3.4, { fixType: 'network' })], { includeApproximate: true }), 'Rig, "North"')
    const [header, row1, row2] = csv.split('\n')
    assert.ok(header.endsWith(',segment,position_source')); assert.ok(row1.includes('"Rig, ""North"""') && row1.endsWith(',gps')); assert.ok(row2.endsWith(',approximate'))
  })

  await t('availability: counts time between reports, not samples; silences longer than the tolerance are offline', () => {
    const base = Date.parse('2026-10-19T08:00:00+01:00'), s: TelemetrySample[] = []
    for (let i = 0; i <= 60; i++) s.push({ ts: base + i * 30_000 })
    for (let i = 0; i <= 20; i++) s.push({ ts: base + 3 * 3_600_000 + i * 30_000 })
    const a = buildAvailability(s, base - MIN, base + 4 * 3_600_000)
    assert.equal(a.medianIntervalMs, 30_000); assert.equal(a.toleranceMs, 120_000, 'never below the backend\'s own two minutes')
    assert.ok(Math.abs(a.totalAvailableMs - 40 * MIN) < 1, String(a.totalAvailableMs / MIN)); assert.equal(formatUptime(a.totalAvailableMs), '40m')
    assert.equal(a.days.reduce((n, d) => n + d.sampleCount, 0), 82, 'every heartbeat counts, with or without a GPS fix')
  })
  await t('availability: a leg across midnight is split between the days; empty days still get a bar', () => {
    const local = (s: string) => Date.parse(s)
    const a = buildAvailability([{ ts: local('2026-10-19T23:59:00+01:00') }, { ts: local('2026-10-20T00:01:00+01:00') }], local('2026-10-18T12:00:00+01:00'), local('2026-10-20T12:00:00+01:00'))
    assert.equal(a.days.length, 3, 'the 18th has no reports but still appears'); assert.equal(a.days[0].availableMs, 0)
    assert.equal(a.days[1].availableMs + a.days[2].availableMs, 2 * MIN); assert.equal(a.days[1].availableMs, MIN); assert.equal(a.days[2].availableMs, MIN)
    assert.equal(formatUptime(3 * 3_600_000 + 51 * MIN), '3h 51m'); assert.equal(formatUptime(3 * 3_600_000), '3h')
  })

  await t('"today" is today in Lagos, even in the first hour after midnight (toISOString would say yesterday)', () => {
    const justAfterMidnight = Date.parse('2026-10-19T00:30:00+01:00')
    assert.equal(justAfterMidnight, Date.parse('2026-10-18T23:30:00Z')); assert.equal(new Date(justAfterMidnight).toISOString().slice(0, 10), '2026-10-18', 'the bug this avoids')
    assert.equal(localDay(justAfterMidnight), '2026-10-19')
    assert.deepEqual(presetDates('today', justAfterMidnight), { fromDate: '2026-10-19', toDate: '2026-10-19' })
  })
  await t('presets: yesterday, last 7 days (today and the six before), last 30 days', () => {
    const now = Date.parse('2026-10-19T12:00:00+01:00')
    assert.deepEqual(presetDates('yesterday', now), { fromDate: '2026-10-18', toDate: '2026-10-18' })
    assert.deepEqual(presetDates('7d', now), { fromDate: '2026-10-13', toDate: '2026-10-19' }); assert.deepEqual(presetDates('30d', now), { fromDate: '2026-09-20', toDate: '2026-10-19' })
    assert.equal(PRESETS.length, 4)
  })
  await t('dates must be real calendar days, in order', () => {
    assert.ok(parseDay('2026-10-19')); for (const bad of ['2026-02-30', '2026-13-01', '2026/10/19', '19-10-2026', '', '2026-1-5']) assert.equal(parseDay(bad), null, bad)
    const r = rangeFromDates('2026-10-19', '2026-10-19') as { from: number; to: number }
    assert.equal(r.from, Date.parse('2026-10-19T00:00:00+01:00')); assert.equal(r.to, Date.parse('2026-10-19T23:59:59.999+01:00'), 'the whole last day is included')
    assert.match((rangeFromDates('2026-10-20', '2026-10-19') as { error: string }).error, /after/); assert.match((rangeFromDates('nope', '2026-10-19') as { error: string }).error, /YYYY-MM-DD/)
  })

  const row = (i: number, extra = {}) => ({ id: i, deviceId: 'd', latitude: '6.5', longitude: '3.4', recordedAt: new Date(T0 + i * MIN).toISOString(), batteryLevel: '80', netStrength: '4', ...extra })
  const pageOf = (rows: object[], totalPages: number) => ({ content: rows, totalPages, totalElements: rows.length, last: true })
  await t('telemetry: asks for exactly the range, newest first, 10,000 a page, with Z times; rows map to samples including fix type and accuracy', async () => {
    http.calls.length = 0
    http.routes = { 'GET /devices/d/telemetry': () => ({ status: 200, data: pageOf([row(1, { fixType: 'network', accuracyMeters: 320.5 }), row(2, { fixType: 'gps' }), row(3, { fixType: null })], 1) }) }
    const r = await fetchTrackSamples('d', T0, T0 + 10 * MIN)
    assert.deepEqual(http.calls[0].params, { from: new Date(T0).toISOString(), to: new Date(T0 + 10 * MIN).toISOString(), sort: 'desc', page: 0, size: 10000 })
    assert.match(String((http.calls[0].params as { from: string }).from), /Z$/, 'UTC, so no +01:00 to encode')
    assert.deepEqual(r.samples.map((s) => s.fixType), ['network', 'gps', undefined]); assert.equal(r.samples[0].accuracyMeters, 320.5); assert.equal(r.truncated, false); assert.equal(http.calls.length, 1, 'one page was enough')
  })
  await t('a range bigger than a page is read page by page and joined', async () => {
    http.calls.length = 0
    http.routes = { 'GET /devices/d/telemetry': (r) => ({ status: 200, data: pageOf((r.params as { page: number }).page === 0 ? [row(1), row(2)] : [row(3)], 2) }) }
    const r = await fetchTrackSamples('d', T0, T0 + 10 * MIN); assert.equal(r.samples.length, 3); assert.deepEqual(http.calls.map((c) => (c.params as { page: number }).page), [0, 1]); assert.equal(r.truncated, false)
  })
  await t('a range too big to pull is cut at MAX_PAGES pages (keeping the newest) and says so', async () => {
    http.calls.length = 0
    http.routes = { 'GET /devices/d/telemetry': () => ({ status: 200, data: pageOf([row(1)], MAX_PAGES + 4) }) }
    const r = await fetchTrackSamples('d', T0, T0 + 10 * MIN); assert.equal(http.calls.length, MAX_PAGES); assert.equal(r.truncated, true); assert.equal(MAX_PAGES, 3)
    http.routes = { 'GET /devices/d/telemetry': () => ({ status: 200, data: pageOf([row(1)], MAX_PAGES) }) }
    assert.equal((await fetchTrackSamples('d', T0, T0 + 10 * MIN)).truncated, false, 'exactly MAX_PAGES pages is complete, not cut')
  })
  await t('without a page count: a short page ends it, a full page means more', async () => {
    http.calls.length = 0; http.routes = { 'GET /devices/d/telemetry': () => ({ status: 200, data: [row(1), row(2)] }) }
    assert.equal((await fetchTrackSamples('d', T0, T0 + MIN)).truncated, false); assert.equal(http.calls.length, 1)
    http.calls.length = 0; const full = Array.from({ length: 10_000 }, (_, i) => row(i + 1)); http.routes = { 'GET /devices/d/telemetry': () => ({ status: 200, data: full }) }
    const r = await fetchTrackSamples('d', T0, T0 + MIN); assert.equal(http.calls.length, MAX_PAGES); assert.equal(r.truncated, true)
  })
  await t('a failing request is an error, not an empty track', async () => {
    http.routes = { 'GET /devices/d/telemetry': () => ({ status: 500 }) }; await assert.rejects(fetchTrackSamples('d', T0, T0 + MIN))
  })

  await t('the sample route has a gap, a far-away reading and indoor fixes, so each can be seen working; it is repeatable', () => {
    const now = Date.now(), s = getMockTrackSamples('866652022956404', now - 24 * 60 * MIN, now)
    assert.deepEqual(s, getMockTrackSamples('866652022956404', now - 24 * 60 * MIN, now).map((x, i) => ({ ...x, ts: s[i].ts })), 'same helmet, same walk')
    const lean = buildTrack('d', s, now - 24 * 60 * MIN, now, false), all = buildTrack('d', s, now - 24 * 60 * MIN, now, false, { includeApproximate: true })
    assert.equal(lean.stats.impossibleJumps, 2); assert.ok(lean.stats.longestGapMs >= 12 * MIN); assert.ok(lean.stats.segments >= 3)
    assert.ok(lean.stats.approximateExcluded > 0); assert.ok(all.stats.distanceMetres > lean.stats.distanceMetres)
    assert.deepEqual(getMockTrackSamples('x', now + MIN, now + 2 * MIN), [], 'nothing from the future')
  })
}
main().then(report)
