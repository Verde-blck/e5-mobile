import assert from 'node:assert/strict'
import { expandPermissions } from '@/shared/constants/backend-permissions'
import type { Alarm, AlarmType } from '@/modules/alarms/types'
import { SOS_CALL_WINDOW_MS, callAccess } from '@/modules/calls/lib/access'
import { IDLE, callReducer, describeCall, formatCallTime } from '@/modules/calls/lib/callState'
import { CallError, callErrorFrom } from '@/modules/calls/lib/engine'
import { mockCallEngine } from '@/modules/calls/lib/engine.mock'
import { callEngine } from '@/modules/calls/lib/engines'
import type { CallEvent, CallState } from '@/modules/calls/types'
import { createRunner } from './harness'

const { t, report } = createRunner()
const MIN = 60_000
const NOW = Date.parse('2026-10-19T14:00:00+01:00')
const ONLINE = '866652022956404', OFFLINE = '866652022959544'
const alarm = (over: Partial<Alarm> = {}): Alarm => ({ id: 'a1', deviceId: ONLINE, deviceName: 'Test Helmet', type: 'sos' as AlarmType, severity: 'critical', status: 'active', raisedAt: NOW - 5 * MIN, ...over })
const run = (events: CallEvent[], from: CallState = IDLE) => events.reduce(callReducer, from)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

  // ---- the state machine ----
  await t('a normal call: microphone, connecting, connected (the timer starts), then you hang up', () => {
    const s = run([{ type: 'start', deviceId: ONLINE }, { type: 'mic-ok' }, { type: 'connected', now: 1000 }, { type: 'hangup', now: 61_000 }])
    assert.deepEqual([s.phase, s.reason, s.startedAt, s.endedAt, s.deviceId], ['ended', 'hung-up', 1000, 61_000, ONLINE])
    assert.deepEqual(run([{ type: 'start', deviceId: 'd' }]).phase, 'mic-permission'); assert.equal(run([{ type: 'start', deviceId: 'd' }, { type: 'mic-ok' }]).phase, 'connecting')
  })
  await t('the helmet hangs up, or the microphone is refused, or the connection fails, or it drops mid-call', () => {
    assert.equal(run([{ type: 'start', deviceId: 'd' }, { type: 'mic-ok' }, { type: 'connected', now: 1 }, { type: 'remote-ended', now: 9 }]).reason, 'remote-ended')
    assert.deepEqual([run([{ type: 'start', deviceId: 'd' }, { type: 'mic-denied' }]).phase, run([{ type: 'start', deviceId: 'd' }, { type: 'mic-denied' }]).reason], ['failed', 'mic-denied'])
    assert.equal(run([{ type: 'start', deviceId: 'd' }, { type: 'mic-ok' }, { type: 'failed', reason: 'unreachable' }]).reason, 'unreachable')
    assert.deepEqual([run([{ type: 'start', deviceId: 'd' }, { type: 'mic-ok' }, { type: 'connected', now: 1 }, { type: 'failed', reason: 'dropped' }]).phase], ['failed'])
  })
  await t('a late callback never revives or corrupts a finished call', () => {
    const ended = run([{ type: 'start', deviceId: 'd' }, { type: 'mic-ok' }, { type: 'hangup', now: 5 }])
    assert.equal(ended.phase, 'ended')
    for (const late of [{ type: 'connected', now: 9 }, { type: 'mic-ok' }, { type: 'remote-ended', now: 9 }, { type: 'failed', reason: 'dropped' }, { type: 'mute', on: true }] as CallEvent[]) assert.deepEqual(callReducer(ended, late), ended, late.type)
    assert.deepEqual(callReducer(IDLE, { type: 'connected', now: 1 }), IDLE, 'nothing connects from idle'); assert.equal(callReducer(IDLE, { type: 'hangup', now: 1 }).phase, 'idle')
  })
  await t('a second start during a call is ignored; after it ends (or fails) a new start begins cleanly, unmuted', () => {
    const live = run([{ type: 'start', deviceId: 'a' }, { type: 'mic-ok' }, { type: 'connected', now: 1 }, { type: 'mute', on: true }])
    assert.deepEqual(callReducer(live, { type: 'start', deviceId: 'b' }), live)
    const again = callReducer(callReducer(live, { type: 'hangup', now: 2 }), { type: 'start', deviceId: 'b' }); assert.deepEqual([again.phase, again.deviceId, again.muted, again.endedAt], ['mic-permission', 'b', false, undefined])
    assert.equal(callReducer(run([{ type: 'start', deviceId: 'a' }, { type: 'mic-denied' }]), { type: 'start', deviceId: 'a' }).phase, 'mic-permission', 'retry after a failure')
  })
  await t('mute and speaker work while connecting or in the call, and nowhere else; reset starts over', () => {
    const active = run([{ type: 'start', deviceId: 'd' }, { type: 'mic-ok' }, { type: 'connected', now: 1 }])
    const toggled = run([{ type: 'mute', on: true }, { type: 'speaker', on: true }], active); assert.deepEqual([toggled.muted, toggled.speaker], [true, true])
    assert.equal(run([{ type: 'mute', on: true }], IDLE).muted, false); assert.equal(callReducer(toggled, { type: 'reset' }), IDLE)
  })
  await t('call time reads 83 s as 01:23, never negative, and an hour as 1:02:03', () => {
    assert.deepEqual([83_000, 0, 5_000, 59_999, 3_723_000, -4000].map(formatCallTime), ['01:23', '00:00', '00:05', '00:59', '1:02:03', '00:00'])
  })
  await t('what the screen says in each state, with the right way forward', () => {
    const n = 'Rig Supervisor'
    assert.equal(describeCall(run([{ type: 'start', deviceId: 'd' }]), n).title, 'Asking for the microphone…'); assert.equal(describeCall(run([{ type: 'start', deviceId: 'd' }, { type: 'mic-ok' }]), n).title, 'Calling Rig Supervisor…')
    assert.deepEqual([describeCall(run([{ type: 'start', deviceId: 'd' }, { type: 'mic-ok' }, { type: 'connected', now: 1 }]), n).tone], ['ok'])
    const ended = run([{ type: 'start', deviceId: 'd' }, { type: 'mic-ok' }, { type: 'connected', now: 1000 }, { type: 'hangup', now: 84_000 }]); assert.deepEqual([describeCall(ended, n).title, describeCall(ended, n).detail], ['Call ended', 'It lasted 01:23.'])
    assert.equal(describeCall(run([{ type: 'start', deviceId: 'd' }, { type: 'mic-ok' }, { type: 'connected', now: 1 }, { type: 'remote-ended', now: 2 }]), n).title, 'Rig Supervisor ended the call')
    const failed = (reason: 'mic-denied' | 'not-allowed' | 'unreachable' | 'dropped' | 'failed') => describeCall({ ...IDLE, phase: 'failed', reason }, n)
    assert.deepEqual([failed('mic-denied').action, failed('unreachable').action, failed('dropped').action, failed('failed').action, failed('not-allowed').action], ['settings', 'retry', 'retry', 'retry', undefined])
    assert.match(failed('unreachable').title, /Rig Supervisor/); assert.match(failed('not-allowed').detail ?? '', /SOS alarm/)
  })

  // ---- failures from the backend ----
  await t('a failed request to start a call becomes the right reason: refused, helmet unreachable, or other', () => {
    const http = (status: number, data: object = {}) => ({ response: { status, data } })
    assert.equal(callErrorFrom(http(403, { error: 'forbidden' })).reason, 'not-allowed'); for (const s of [404, 409, 502, 503, 504]) assert.equal(callErrorFrom(http(s)).reason, 'unreachable', String(s))
    assert.equal(callErrorFrom(http(500)).reason, 'failed'); assert.equal(callErrorFrom(new Error('Network Error')).reason, 'failed'); assert.equal(callErrorFrom(new Error('boom')).detail, 'boom')
    const own = new CallError('unreachable'); assert.equal(callErrorFrom(own), own)
  })

  // ---- the engines ----
  await t('a real build offers no calling at all yet (so no button that can only fail); a call attempt is refused', async () => {
    assert.equal(callEngine.isSupported(), false); assert.equal(await callEngine.requestMic(), false)
    await assert.rejects(callEngine.connect(ONLINE, { onConnected() {}, onEnded() {} }))
  })
  await t('the simulated engine connects an online helmet, reports the helmet hanging up, and refuses an offline one', async () => {
    assert.equal(mockCallEngine.isSupported(), true); assert.equal(await mockCallEngine.requestMic(), true)
    const events: string[] = []
    const session = await mockCallEngine.connect(ONLINE, { onConnected: () => events.push('connected'), onEnded: (r) => events.push('ended:' + r) })
    await sleep(900); assert.deepEqual(events, ['connected'])
    ;(globalThis as { __e5CallRemoteEnd?: () => void }).__e5CallRemoteEnd?.(); assert.deepEqual(events, ['connected', 'ended:remote-ended'])
    session.setMuted(true); session.setSpeaker(true); await session.hangup()
    const log = (globalThis as { __e5CallLog?: { op: string }[] }).__e5CallLog ?? []; assert.deepEqual(log.map((e) => e.op), ['connect', 'mute', 'speaker', 'hangup'])
    await assert.rejects(mockCallEngine.connect(OFFLINE, { onConnected() {}, onEnded() {} }), (e: CallError) => e.reason === 'unreachable')
  })
  await t('the simulated engine can block the microphone or refuse the call, for testing those screens', async () => {
    const g = globalThis as { __e5MicDeny?: boolean; __e5CallDeny?: boolean }
    g.__e5MicDeny = true; assert.equal(await mockCallEngine.requestMic(), false); g.__e5MicDeny = false
    g.__e5CallDeny = true; await assert.rejects(mockCallEngine.connect(ONLINE, { onConnected() {}, onEnded() {} }), (e: CallError) => e.reason === 'not-allowed'); g.__e5CallDeny = false
  })
}
main().then(report)
