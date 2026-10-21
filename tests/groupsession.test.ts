import assert from 'node:assert/strict'
import { activeGroupCall, getGroupCall, startGroupCall, stopGroupCall, toGroupCall, type GroupCall } from '@/modules/live/api/groupCall.api'
import { GROUP_CALL_MAX, callPlan, toggleChosen } from '@/modules/live/lib/groupPlan'
import { GroupCallSession, type GroupDeps } from '@/modules/live/lib/groupSession'
import { NotReadyError, type MediaConnection } from '@/modules/live/lib/signalling'
import type { StreamLike, TrackLike } from '@/modules/live/types'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const until = async (cond: () => boolean, ms = 1500) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await sleep(5); assert.ok(cond(), 'timed out waiting') }
const track = (kind: string): TrackLike & { kind: string; stopped: boolean } => { const tr = { kind, enabled: true, stopped: false, stop() { tr.stopped = true } }; return tr }
const stream = (...kinds: string[]): StreamLike & { tracks: ReturnType<typeof track>[] } => { const tracks = kinds.map(track); return { tracks, getTracks: () => tracks, getAudioTracks: () => tracks.filter((x) => x.kind === 'audio'), getVideoTracks: () => tracks.filter((x) => x.kind === 'video') } }
const conn = (): MediaConnection & { closed: boolean; lose: () => void } => { let lost: (() => void) | null = null; const c = { stream: stream('video', 'audio') as StreamLike, closed: false, close() { c.closed = true }, onLost(cb: () => void) { lost = cb }, lose() { lost?.() } }; return c }
const call = (ids: string[], offline: string[] = []): GroupCall => ({ callId: 'c1', adminPushUrl: 'https://m/push', helmets: ids.map((id) => ({ deviceId: id, delivered: !offline.includes(id), watchUrl: `https://m/watch/${id}` })) })

function fake(over: Partial<GroupDeps> = {}, broken: string[] = []) {
  const log: string[] = []; const remote = new Map<string, ReturnType<typeof conn>[]>(); const outgoing: ReturnType<typeof conn>[] = []; const mic = stream('audio', 'video'); let background: ((b: boolean) => void) | null = null
  const deps: GroupDeps & { log: string[]; remote: typeof remote; outgoing: typeof outgoing; mic: typeof mic; setBackground: (b: boolean) => void } = {
    log, remote, outgoing, mic, setBackground: (b) => background?.(b),
    startGroupCall: async (ids) => { log.push(`start:${ids.join(',')}`); return call([...ids]) },
    stopGroupCall: async (id) => { log.push(`stop:${id}`) },
    getLocalMedia: async (cam) => { log.push(`media:${cam}`); return { stream: mic, noCamera: false } },
    play: async (url) => { const id = url.split('/').pop()!; log.push(`play:${id}`); if (broken.includes(id)) throw new NotReadyError('no picture'); const c = conn(); remote.set(id, [...(remote.get(id) ?? []), c]); return c },
    push: async () => { log.push('push'); const c = conn(); outgoing.push(c); return c },
    rememberCall: (id) => { log.push(`remember:${id}`) },
    watchBackground: (cb) => { background = cb; return () => { background = null } },
    timing: { intervalMs: 5, deadlineMs: 60, outgoingDeadlineMs: 60, leaveGraceMs: 40 },
    ...over,
  }
  return deps
}
const live = (s: GroupCallSession, id: string) => s.getState().participants.find((p) => p.deviceId === id)?.status

async function main() {
  // =============== who can start what ===============
  await t('one helmet is a one-to-one call, two or more a group call, never more than eight, and each needs its own permission', () => {
    const both = { single: true, group: true }
    assert.deepEqual(callPlan(['a'], both), { kind: 'single', deviceId: 'a' }); assert.deepEqual(callPlan(['a', 'b'], both), { kind: 'group', deviceIds: ['a', 'b'] })
    const eight = Array.from({ length: GROUP_CALL_MAX }, (_, i) => String(i)); assert.equal(callPlan(eight, both).kind, 'group'); assert.equal(GROUP_CALL_MAX, 8)
    const nine = callPlan([...eight, 'x'], both); assert.equal(nine.kind, 'none'); assert.match((nine as { reason: string }).reason, /up to 8 helmets. Deselect 1\./)
    assert.match((callPlan([], both) as { reason: string }).reason, /Select at least one active helmet/)
    assert.equal(callPlan(['a', 'b'], { single: true, group: false }).kind, 'none', 'live management alone can\'t start a group call'); assert.match((callPlan(['a', 'b'], { single: true, group: false }) as { reason: string }).reason, /GROUP_CALL/)
    assert.deepEqual(callPlan(['a'], { single: false, group: true }), { kind: 'group', deviceIds: ['a'] }, 'group call alone can still call one helmet, as a group of one')
    assert.match((callPlan(['a'], { single: false, group: false }) as { reason: string }).reason, /can't place calls/)
  })
  await t('ticking toggles a helmet, in the order chosen, and a deactivated helmet can\'t be ticked', () => {
    assert.deepEqual(toggleChosen([], { id: 'a', active: true }), ['a']); assert.deepEqual(toggleChosen(['a'], { id: 'b', active: true }), ['a', 'b']); assert.deepEqual(toggleChosen(['a', 'b'], { id: 'a', active: true }), ['b'])
    assert.deepEqual(toggleChosen(['a'], { id: 'z', active: false }), ['a']); assert.deepEqual(toggleChosen(['z'], { id: 'z', active: false }), [], 'one deactivated since it was ticked can still be unticked')
  })

  // =============== the API ===============
  await t('starting a call POSTs the helmets to the backend (at most eight) and reads the room it returns; no room is an error', async () => {
    http.calls.length = 0; http.routes = { 'POST /webrtc-group-call/start': () => ({ status: 200, data: { callId: 'abc', adminPushUrl: 'https://m/push', helmets: [{ deviceId: 'a', delivered: true, watchUrl: 'https://m/w/a' }, { deviceId: 'b', delivered: false }] } }) }
    const c = await startGroupCall(['a', 'b']); assert.equal(`${http.calls[0].method} ${http.calls[0].url}`, 'POST /webrtc-group-call/start'); assert.deepEqual(http.calls[0].data, { deviceIds: ['a', 'b'] })
    assert.deepEqual(c, { callId: 'abc', adminPushUrl: 'https://m/push', helmets: [{ deviceId: 'a', delivered: true, watchUrl: 'https://m/w/a' }, { deviceId: 'b', delivered: false, watchUrl: '' }] })
    await startGroupCall(Array.from({ length: 12 }, (_, i) => String(i))); assert.equal((http.calls[1].data as { deviceIds: string[] }).deviceIds.length, 8, 'never more than the backend allows')
    assert.throws(() => toGroupCall({}), /didn.t return a call/); assert.equal(toGroupCall({ callId: 'x', helmets: [{ deviceId: 'a', delivered: 'yes' as never }] }).helmets[0].delivered, false, '"delivered" must be exactly true')
  })
  await t('a call can be looked up again (null once it is gone) and stopped (which never throws, so a call always ends on this side)', async () => {
    http.routes = { 'GET /webrtc-group-call/abc': () => ({ status: 200, data: { callId: 'abc', helmets: [] } }), 'GET /webrtc-group-call/gone': () => ({ status: 404 }), 'GET /webrtc-group-call/bad': () => ({ status: 500 }), 'POST /webrtc-group-call/abc/stop': () => ({ status: 500 }) }
    assert.equal((await getGroupCall('abc'))?.callId, 'abc'); assert.equal(await getGroupCall('gone'), null, '404 means it has ended'); await assert.rejects(getGroupCall('bad'))
    http.calls.length = 0; await stopGroupCall('abc'); assert.equal(`${http.calls[0].method} ${http.calls[0].url}`, 'POST /webrtc-group-call/abc/stop')
  })

  // =============== the call ===============
  await t('a group call: camera and microphone first, then every helmet is called at once, and each connects on its own connection', async () => {
    const d = fake(); const s = new GroupCallSession(d, true); assert.equal(s.getState().status, 'requesting-media'); await s.start(['a', 'b', 'c']); await until(() => ['a', 'b', 'c'].every((id) => live(s, id) === 'live'))
    assert.deepEqual(d.log.slice(0, 3), ['media:true', 'start:a,b,c', 'remember:c1'], 'microphone and camera before any helmet is touched, and the call is remembered at once'); assert.equal(d.log.filter((x) => x === 'push').length, 1, 'our voice and picture go out ONCE, to the room')
    assert.equal(s.getState().status, 'active'); assert.ok(s.getState().startedAt); assert.equal(s.getState().participants.length, 3); assert.ok(s.getState().participants.every((p) => p.stream)); s.end()
  })
  await t('a helmet that is offline is "unreachable" (it won\'t join later) and nothing tries to connect to it; the others carry on', async () => {
    const d = fake({ startGroupCall: async (ids) => call([...ids], ['b']) }); const s = new GroupCallSession(d, false); await s.start(['a', 'b']); await until(() => live(s, 'a') === 'live')
    assert.equal(live(s, 'b'), 'unreachable'); assert.ok(!d.log.includes('play:b')); s.end()
  })
  await t('one helmet with no picture fails on its own tile and the others are untouched; trying again recovers it', async () => {
    const broken = ['b']; const d = fake({}, broken); const s = new GroupCallSession(d, false); await s.start(['a', 'b', 'c']); await until(() => live(s, 'b') === 'failed' && live(s, 'a') === 'live' && live(s, 'c') === 'live')
    broken.length = 0; s.retryHelmet('b'); await until(() => live(s, 'b') === 'live'); s.retryHelmet('a'); assert.equal(live(s, 'a'), 'live', 'only a failed one is retried'); s.end()
  })
  await t('a dropped connection is "reconnecting" and then live again, for that helmet only', async () => {
    const d = fake(); const s = new GroupCallSession(d, false); await s.start(['a', 'b']); await until(() => live(s, 'a') === 'live' && live(s, 'b') === 'live')
    d.remote.get('a')![0].lose(); await until(() => d.remote.get('a')!.length === 2 && live(s, 'a') === 'live'); assert.ok(d.remote.get('a')![0].closed); assert.equal(live(s, 'b'), 'live'); assert.equal(d.remote.get('b')!.length, 1, 'the other helmet was not touched'); s.end()
  })
  await t('if the microphone or camera is refused, no helmet is ever put into call mode, and the message names both', async () => {
    const d = fake({ getLocalMedia: async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }) } }); const s = new GroupCallSession(d, true); await s.start(['a', 'b'])
    assert.equal(s.getState().status, 'failed'); assert.match(s.getState().error ?? '', /microphone or camera is blocked/); assert.ok(!d.log.some((x) => x.startsWith('start:') || x.startsWith('stop:')), 'the helmets were never touched'); s.end(); assert.ok(!d.log.some((x) => x.startsWith('stop:')))
  })
  await t('hanging up ends the call on EVERY helmet in one stop, closes every connection, releases camera and microphone, and forgets the call', async () => {
    const d = fake(); const s = new GroupCallSession(d, true); await s.start(['a', 'b', 'c']); await until(() => ['a', 'b', 'c'].every((id) => live(s, id) === 'live')); await until(() => d.outgoing.length === 1)
    s.end(); assert.equal(s.getState().status, 'ended'); assert.deepEqual(d.log.filter((x) => x.startsWith('stop:')), ['stop:c1'], 'one stop covers the whole call'); assert.ok([...d.remote.values()].flat().every((c) => c.closed) && d.outgoing[0].closed)
    assert.ok(d.mic.tracks.every((x) => x.stopped), 'camera and microphone are off'); assert.ok(s.getState().participants.every((p) => p.stream === null), 'no picture is left attached to a dead stream'); assert.equal(d.log.at(-1), 'remember:null'); assert.equal(s.getState().localStream, null); s.end(); assert.equal(d.log.filter((x) => x.startsWith('stop:')).length, 1, 'ending twice sends one stop')
  })
  await t('hanging up while the start request is still in flight still ends the call on every helmet, after it was made', async () => {
    let release: () => void = () => {}; const gate = new Promise<void>((r) => (release = r)); const d = fake({ startGroupCall: async (ids) => { d.log.push(`start:${ids.join(',')}`); await gate; d.log.push('start-done'); return call([...ids]) } })
    const s = new GroupCallSession(d, false); const started = s.start(['a', 'b']); await until(() => d.log.includes('start:a,b')); s.end(); release(); await started
    assert.ok(d.log.indexOf('start-done') < d.log.lastIndexOf('stop:c1'), 'the stop lands after the start'); assert.ok(!d.log.some((x) => x.startsWith('play:')), 'and nothing connected')
  })
  await t('mute and camera work on their own, an audio-only call has no camera to switch, and with no camera it carries on as voice and says so', async () => {
    const d = fake(); const s = new GroupCallSession(d, true); await s.start(['a']); await until(() => live(s, 'a') === 'live')
    s.toggleMic(); assert.deepEqual([s.getState().micOn, s.getState().cameraOn, d.mic.tracks[0].enabled], [false, true, false]); s.toggleCamera(); assert.deepEqual([s.getState().cameraOn, d.mic.tracks[1].enabled, s.getState().micOn], [false, false, false]); s.end()
    const audio = new GroupCallSession(fake(), false); await audio.start(['a']); audio.toggleCamera(); assert.equal(audio.getState().cameraOn, false); audio.end()
    const none = new GroupCallSession(fake({ getLocalMedia: async () => ({ stream: stream('audio'), noCamera: true }) }), true); await none.start(['a']); assert.deepEqual([none.getState().noCamera, none.getState().cameraOn], [true, false]); none.end()
  })
  await t('if our voice cannot reach the room the call stays up and says so; with no room address at all it says so at once', async () => {
    const d = fake({ push: async () => { throw new NotReadyError('no') } }); const s = new GroupCallSession(d, false); await s.start(['a']); await until(() => s.getState().outgoingFailed); assert.equal(s.getState().status, 'active'); s.end()
    const none = new GroupCallSession(fake({ startGroupCall: async (ids) => ({ ...call([...ids]), adminPushUrl: '' }) }), false); await none.start(['a']); assert.equal(none.getState().outgoingFailed, true); none.end()
  })
  await t('a tablet cannot keep a call in the background: out of sight past the grace period ends it for every helmet; a quick glance away, or a permission dialog, does not', async () => {
    const d = fake(); const s = new GroupCallSession(d, false); await s.start(['a', 'b']); await until(() => live(s, 'a') === 'live')
    d.setBackground(true); await sleep(15); d.setBackground(false); await sleep(60); assert.equal(s.getState().status, 'active', 'back within the grace period')
    d.setBackground(true); await sleep(90); assert.equal(s.getState().status, 'ended'); assert.equal(s.getState().endReason, 'left-app'); assert.ok(d.log.includes('stop:c1'))
    let release: () => void = () => {}; const gate = new Promise<{ stream: StreamLike; noCamera: boolean }>((r) => (release = () => r({ stream: stream('audio'), noCamera: false }))); const d2 = fake({ getLocalMedia: () => gate })
    const s2 = new GroupCallSession(d2, false); const started = s2.start(['a']); d2.setBackground(true); await sleep(100); assert.equal(s2.getState().status, 'requesting-media', 'the permission dialog is not leaving'); d2.setBackground(false); release(); await started; s2.end()
  })
  await t('a call left running by an app that was closed is remembered, so the next opening can offer to end it', async () => {
    http.routes = {}; await activeGroupCall.set('left-over'); assert.equal(await activeGroupCall.get(), 'left-over'); await activeGroupCall.set(null); assert.equal(await activeGroupCall.get(), null)
  })
}
main().then(report)
