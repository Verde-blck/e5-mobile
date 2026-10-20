import assert from 'node:assert/strict'
import { expandPermissions } from '@/shared/constants/backend-permissions'
import type { Alarm, AlarmType } from '@/modules/alarms/types'
import { SOS_CALL_WINDOW_MS, callAccess } from '@/modules/calls/lib/access'
import { createRunner } from './harness'

const { t, report } = createRunner()
const MIN = 60_000
const NOW = Date.parse('2026-10-19T14:00:00+01:00')
const ONLINE = '866652022956404', OFFLINE = '866652022959544'
const alarm = (over: Partial<Alarm> = {}): Alarm => ({ id: 'a1', deviceId: ONLINE, deviceName: 'Test Helmet', type: 'sos' as AlarmType, severity: 'critical', status: 'active', raisedAt: NOW - 5 * MIN, ...over })

async function main() {
  // ---- who may call (the backend's rule; the tablet decides only what to offer) ----
  await t('an open SOS for the helmet lets ANYONE signed in call it, for 30 minutes', () => {
    const a = (raisedAgo: number) => callAccess({ deviceId: ONLINE, alarms: [alarm({ raisedAt: NOW - raisedAgo })], canManage: false, now: NOW })
    assert.deepEqual(a(5 * MIN), { allowed: true, basis: 'sos', alarmId: 'a1' })
    assert.equal(a(SOS_CALL_WINDOW_MS - 1000).allowed, true, '29:59 is inside')
    assert.equal(a(SOS_CALL_WINDOW_MS).allowed, false, '30:00 is out'); assert.equal(a(SOS_CALL_WINDOW_MS + 1000).allowed, false)
    assert.equal(SOS_CALL_WINDOW_MS, 30 * MIN)
  })
  await t('but only an OPEN SOS, for THAT helmet: resolved, other helmets and other alarm types give nothing', () => {
    const none = (alarms: Alarm[]) => callAccess({ deviceId: ONLINE, alarms, canManage: false, now: NOW })
    assert.equal(none([alarm({ status: 'resolved' })]).allowed, false); assert.equal(none([alarm({ deviceId: 'other' })]).allowed, false)
    for (const type of ['fall', 'near-electric', 'geofence-exit', 'low-battery'] as AlarmType[]) assert.equal(none([alarm({ type })]).allowed, false, type)
    assert.equal(none([alarm({ type: 'sos-button' })]).allowed, true, 'the SOS button counts as an SOS too'); assert.equal(none([]).allowed, false)
  })
  await t('a clock a minute ahead of the alarm is fine; an alarm dated well in the future is not trusted', () => {
    assert.equal(callAccess({ deviceId: ONLINE, alarms: [alarm({ raisedAt: NOW + 30_000 })], canManage: false, now: NOW }).allowed, true)
    assert.equal(callAccess({ deviceId: ONLINE, alarms: [alarm({ raisedAt: NOW + 10 * MIN })], canManage: false, now: NOW }).allowed, false)
  })
  await t('any other call needs the live-view management permission; with an SOS too, the SOS is the stated reason', () => {
    assert.deepEqual(callAccess({ deviceId: ONLINE, alarms: [], canManage: true, now: NOW }), { allowed: true, basis: 'permission' })
    assert.deepEqual(callAccess({ deviceId: ONLINE, alarms: [alarm({ id: 'old', raisedAt: NOW - 20 * MIN }), alarm({ id: 'new', raisedAt: NOW - 2 * MIN })], canManage: true, now: NOW }), { allowed: true, basis: 'sos', alarmId: 'new' }, 'the most recent SOS')
    assert.equal(callAccess({ deviceId: ONLINE, alarms: [], canManage: false, now: NOW }).allowed, false)
  })
  await t('live view and calls map to the `live` capability: SURVEILLANCE views, SURVEILLANCE_MANAGE manages', () => {
    assert.deepEqual(expandPermissions(['SURVEILLANCE']), ['live:read']); assert.deepEqual(expandPermissions(['SURVEILLANCE_MANAGE']).sort(), ['live:delete', 'live:read', 'live:write'])
  })
}
main().then(report)
