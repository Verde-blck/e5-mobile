import assert from 'node:assert/strict'
import { endLiveForEveryone, liveAvailable, startCall, startLive, stopCall } from '@/modules/live/api/live.api'
import { formatCallTime } from '@/modules/live/lib/format'
import { HelmetSession, describe, type SessionDeps } from '@/modules/live/lib/session'
import { NotReadyError, SessionEndedError, connectWithRetry, exchange, type MediaConnection, type PeerLike } from '@/modules/live/lib/signalling'
import type { SessionStatus, StreamLike, TrackLike } from '@/modules/live/types'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const until = async (cond: () => boolean, ms = 1500) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await sleep(5); assert.ok(cond(), 'timed out waiting') }

// ---------- fakes: a peer connection, streams, and the platform's dependencies ----------
function fakePeer(log: string[] = []) {
  const peer: PeerLike & { local?: string; remote?: string } = {
    createOffer: async () => { log.push('offer'); return { sdp: 'OFFER-SDP' } },
    setLocalDescription: async (d) => { log.push('local'); peer.local = d.sdp },
    setRemoteDescription: async (d) => { log.push('remote'); peer.remote = d.sdp },
  }
  return peer
}
const track = (kind: string): TrackLike & { kind: string; stopped: boolean } => { const tr = { kind, enabled: true, stopped: false, stop() { tr.stopped = true } }; return tr }
const stream = (...kinds: string[]): StreamLike & { tracks: ReturnType<typeof track>[] } => {
  const tracks = kinds.map(track)
  return { tracks, getTracks: () => tracks, getAudioTracks: () => tracks.filter((x) => x.kind === 'audio'), getVideoTracks: () => tracks.filter((x) => x.kind === 'video') }
}
function connection(): MediaConnection & { closed: boolean; lose: () => void; s: ReturnType<typeof stream> } {
  let lost: (() => void) | null = null; const s = stream('video', 'audio')
  const c = { s, stream: s as StreamLike, closed: false, close() { c.closed = true }, onLost(cb: () => void) { lost = cb }, lose() { lost?.() } }
  return c
}
function fakeDeps(over: Partial<SessionDeps> = {}) {
  const calls: string[] = []; const conns = { remote: [] as ReturnType<typeof connection>[], outgoing: [] as ReturnType<typeof connection>[] }
  let background: ((b: boolean) => void) | null = null; const mic = stream('audio')
  const deps: SessionDeps & { calls: string[]; conns: typeof conns; mic: typeof mic; setBackground: (b: boolean) => void } = {
    calls, conns, mic, setBackground: (b) => background?.(b),
    startCall: async (id) => { calls.push(`startCall:${id}`); return { delivered: true, watchUrl: 'https://media/watch', adminPushUrl: 'https://media/push' } },
    startLive: async (id) => { calls.push(`startLive:${id}`); return { delivered: true, watchUrl: 'https://media/watch' } },
    stopCall: async (id) => { calls.push(`stopCall:${id}`) },
    getLocalMedia: async () => { calls.push('getLocalMedia'); return mic },
    play: async () => { calls.push('play'); const c = connection(); conns.remote.push(c); return c },
    push: async () => { calls.push('push'); const c = connection(); conns.outgoing.push(c); return c },
    watchBackground: (cb) => { background = cb; return () => { background = null } },
    timing: { intervalMs: 5, deadlineMs: 80, outgoingDeadlineMs: 60, leaveGraceMs: 40 },
    ...over,
  }
  return deps
}
const watchStatuses = (s: HelmetSession) => { const seen: SessionStatus[] = [s.getState().status]; s.subscribe(() => { const x = s.getState().status; if (seen[seen.length - 1] !== x) seen.push(x) }); return seen }

async function main() {
  // =============== the exchange with the media server ===============
  await t('the exchange: offer, local description, the SDP POSTed as plain text, then the answer set as remote', async () => {
    const log: string[] = []; const peer = fakePeer(log); let sent: { url: string; init: RequestInit } | null = null
    const fakeFetch = (async (url: string, init: RequestInit) => { sent = { url, init }; log.push('fetch'); return { json: async () => ({ code: 0, sdp: 'ANSWER-SDP' }) } }) as unknown as typeof fetch
    await exchange('https://media/index/api/webrtc?stream=a', peer, new AbortController().signal, fakeFetch)
    assert.deepEqual(log, ['offer', 'local', 'fetch', 'remote'], 'in this order'); assert.equal(sent!.url, 'https://media/index/api/webrtc?stream=a'); assert.equal(sent!.init.method, 'POST')
    assert.equal(sent!.init.body, 'OFFER-SDP'); assert.deepEqual(sent!.init.headers, { 'Content-Type': 'text/plain;charset=utf-8' }); assert.equal(peer.remote, 'ANSWER-SDP')
  })
  await t('"not ready yet" (a non-zero code, or no sdp) is a NotReadyError carrying the server\'s words, and never sets a remote description', async () => {
    const run = async (body: object) => { const log: string[] = []; const e = await exchange('u', fakePeer(log), new AbortController().signal, (async () => ({ json: async () => body })) as unknown as typeof fetch).catch((x) => x); return { e, log } }
    const a = await run({ code: -400, msg: 'stream not found' }); assert.ok(a.e instanceof NotReadyError && a.e.message === 'stream not found' && !a.log.includes('remote'))
    const b = await run({ code: -1 }); assert.match(b.e.message, /code -1/); const c = await run({ code: 0 }); assert.ok(c.e instanceof NotReadyError, 'code 0 with no sdp is not a connection')
  })
  await t('an attempt that stalls is cut off after its timeout, and a session that ends aborts the request in flight', async () => {
    const hang = ((_u: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as unknown as typeof fetch
    const started = Date.now(); const e = await exchange('u', fakePeer(), new AbortController().signal, hang, 40).catch((x) => x)
    assert.equal(e.name, 'AbortError'); assert.ok(Date.now() - started < 400, 'did not hang')
    const ended = new AbortController(); const p = exchange('u', fakePeer(), ended.signal, hang, 5_000).catch((x) => x); await sleep(20); ended.abort()
    assert.equal((await p).name, 'AbortError', 'ending the session aborts the request')
  })
  await t('retrying: works first time, or after "not ready", gives up with the last error at the deadline, and stops the moment the session ends', async () => {
    const ok = connection(); let n = 0
    assert.equal(await connectWithRetry(async () => ok, new AbortController().signal, { intervalMs: 5, deadlineMs: 100 }), ok)
    const flaky = await connectWithRetry(async () => { if (++n < 3) throw new NotReadyError('not yet'); return ok }, new AbortController().signal, { intervalMs: 5, deadlineMs: 500 }); assert.equal(n, 3); assert.equal(flaky, ok)
    await assert.rejects(connectWithRetry(async () => { throw new NotReadyError('still no') }, new AbortController().signal, { intervalMs: 5, deadlineMs: 40 }), (e: Error) => e instanceof NotReadyError && e.message === 'still no')
    const ac = new AbortController(); const p = connectWithRetry(async () => { throw new Error('x') }, ac.signal, { intervalMs: 5, deadlineMs: 5_000 }).catch((e) => e); await sleep(20); ac.abort()
    assert.ok((await p) instanceof SessionEndedError)
  })

  // =============== a call ===============
  await t('a call: the microphone is asked for BEFORE the helmet is touched, then start, then both directions connect', async () => {
    const deps = fakeDeps(); const s = new HelmetSession('dev1', 'call', deps); const seen = watchStatuses(s)
    assert.equal(s.getState().status, 'requesting-media'); await s.start(); await until(() => s.getState().status === 'live')
    assert.deepEqual(deps.calls.slice(0, 2), ['getLocalMedia', 'startCall:dev1'], 'microphone first'); assert.ok(deps.calls.includes('push') && deps.calls.includes('play'))
    assert.deepEqual(seen, ['requesting-media', 'starting', 'connecting', 'live']); const st = s.getState()
    assert.ok(st.remoteStream && st.localStream === deps.mic && st.liveSince && st.liveSince <= Date.now() && !st.outgoingFailed && st.micOn)
    s.end()
  })
  await t('if the microphone is refused, the helmet is NEVER put into call mode and nothing is sent to stop it', async () => {
    const deps = fakeDeps({ getLocalMedia: async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }) } }); const s = new HelmetSession('dev1', 'call', deps); await s.start()
    assert.equal(s.getState().status, 'failed'); assert.match(s.getState().error ?? '', /microphone is blocked/); assert.ok(!deps.calls.some((c) => c.startsWith('startCall') || c.startsWith('stopCall')), 'the helmet was never touched'); s.end()
    assert.ok(!deps.calls.includes('stopCall:dev1'), 'ending a call that never started sends no stop')
  })
  await t('an offline helmet: "offline" (the command is not queued), nothing tries to connect, and ending still tidies the helmet', async () => {
    const deps = fakeDeps({ startCall: async () => ({ delivered: false, watchUrl: '', adminPushUrl: '' }) }); const s = new HelmetSession('dev1', 'call', deps); await s.start()
    assert.equal(s.getState().status, 'offline'); assert.ok(!deps.calls.includes('play') && !deps.calls.includes('push')); s.end(); assert.ok(deps.calls.includes('stopCall:dev1'))
    assert.ok(deps.mic.tracks[0].stopped, 'the microphone is released')
  })
  await t('hanging up while the start request is still in flight: the helmet is still taken out of call mode, after the start lands', async () => {
    let release: () => void = () => {}; const gate = new Promise<void>((r) => (release = r)); const deps = fakeDeps({ startCall: async (id) => { deps.calls.push(`startCall:${id}`); await gate; deps.calls.push('startCall-done'); return { delivered: true, watchUrl: 'w', adminPushUrl: 'p' } } })
    const s = new HelmetSession('dev1', 'call', deps); const started = s.start(); await until(() => deps.calls.includes('startCall:dev1')); s.end(); release(); await started
    assert.equal(deps.calls.at(-1), 'stopCall:dev1', 'the last thing sent is the stop'); assert.ok(deps.calls.indexOf('startCall-done') < deps.calls.lastIndexOf('stopCall:dev1')); assert.ok(!deps.calls.includes('play'), 'and nothing connected')
  })
  await t('hanging up: both connections close, the microphone is released, the helmet is stopped once, and nothing can revive it', async () => {
    const deps = fakeDeps(); const s = new HelmetSession('dev1', 'call', deps); await s.start(); await until(() => s.getState().status === 'live')
    s.end(); assert.equal(s.getState().status, 'ended'); assert.ok(deps.conns.remote[0].closed && deps.conns.outgoing[0].closed && deps.mic.tracks[0].stopped)
    assert.deepEqual(deps.calls.filter((c) => c.startsWith('stopCall')), ['stopCall:dev1']); assert.deepEqual([s.getState().remoteStream, s.getState().localStream], [null, null])
    s.end(); assert.equal(deps.calls.filter((c) => c.startsWith('stopCall')).length, 1, 'ending twice sends one stop'); s.toggleMic(); assert.equal(s.getState().status, 'ended')
  })
  await t('mute switches the microphone track off and on; the call carries on', async () => {
    const deps = fakeDeps(); const s = new HelmetSession('dev1', 'call', deps); await s.start(); await until(() => s.getState().status === 'live')
    s.toggleMic(); assert.deepEqual([s.getState().micOn, deps.mic.tracks[0].enabled], [false, false]); s.toggleMic(); assert.deepEqual([s.getState().micOn, deps.mic.tracks[0].enabled], [true, true]); s.end()
  })
  await t('if our voice cannot reach the helmet the call stays up, and says so (so the person is not talking to nobody)', async () => {
    const deps = fakeDeps({ push: async () => { throw new NotReadyError('no') } }); const s = new HelmetSession('dev1', 'call', deps); await s.start()
    await until(() => s.getState().outgoingFailed); assert.equal(s.getState().status, 'live', 'the helmet can still be heard'); s.end()
  })

  // =============== live view, retries and drops ===============
  await t('live view needs no microphone, and closing it sends nothing to the helmet (others may be watching)', async () => {
    const deps = fakeDeps(); const s = new HelmetSession('dev1', 'watch', deps); await s.start(); await until(() => s.getState().status === 'live')
    assert.ok(deps.calls.includes('startLive:dev1') && !deps.calls.includes('getLocalMedia') && !deps.calls.includes('push')); s.end()
    assert.ok(deps.conns.remote[0].closed); assert.ok(!deps.calls.some((c) => c.startsWith('stopCall')), 'no stop for a viewer')
  })
  await t('joining a stream someone else started works the same', async () => {
    const deps = fakeDeps({ startLive: async () => ({ delivered: true, watchUrl: 'w', alreadyLive: true }) }); const s = new HelmetSession('dev1', 'watch', deps); await s.start(); await until(() => s.getState().status === 'live'); s.end()
  })
  await t('the picture can take a few tries (5 to 10 s on a real helmet): it connects as soon as the media server is ready', async () => {
    let tries = 0; const deps = fakeDeps({ play: async () => { tries++; if (tries < 3) throw new NotReadyError('not yet'); return connection() } }); const s = new HelmetSession('dev1', 'watch', deps)
    await s.start(); await until(() => s.getState().status === 'live'); assert.equal(tries, 3); s.end()
  })
  await t('if it never comes: "failed" with a sentence a person can act on, and Try again retries without re-sending start', async () => {
    let ready = false; const deps = fakeDeps({ play: async () => { deps.calls.push('play'); if (!ready) throw new NotReadyError('no stream'); return connection() } }); const s = new HelmetSession('dev1', 'watch', deps)
    await s.start(); assert.equal(s.getState().status, 'failed'); assert.match(s.getState().error ?? '', /30 seconds/)
    ready = true; const startsBefore = deps.calls.filter((c) => c.startsWith('startLive')).length; s.retry(); await until(() => s.getState().status === 'live')
    assert.equal(deps.calls.filter((c) => c.startsWith('startLive')).length, startsBefore, 'start is not sent again'); s.end()
  })
  await t('a dropped connection is "reconnecting", then live again, with the call timer carrying on from the first picture', async () => {
    const deps = fakeDeps(); const s = new HelmetSession('dev1', 'watch', deps); const seen = watchStatuses(s); await s.start(); await until(() => s.getState().status === 'live')
    const since = s.getState().liveSince; deps.conns.remote[0].lose(); await until(() => deps.conns.remote.length === 2 && s.getState().status === 'live')
    assert.ok(seen.includes('reconnecting')); assert.equal(s.getState().liveSince, since, 'one continuous call'); assert.ok(deps.conns.remote[0].closed); s.end()
  })

  // =============== leaving the app (a tablet cannot keep a call in the background) ===============
  await t('out of sight past the grace period ends a call and stops the helmet; a quick glance away (notification shade) does not', async () => {
    const deps = fakeDeps(); const s = new HelmetSession('dev1', 'call', deps); await s.start(); await until(() => s.getState().status === 'live')
    deps.setBackground(true); await sleep(15); deps.setBackground(false); await sleep(60); assert.equal(s.getState().status, 'live', 'back within the grace period: still in the call')
    deps.setBackground(true); await sleep(80); assert.equal(s.getState().status, 'ended'); assert.ok(deps.calls.includes('stopCall:dev1'), 'the helmet was taken out of call mode')
  })
  await t('while the microphone permission dialog is up (the app is paused) a call is NOT ended: that is not leaving', async () => {
    let release: () => void = () => {}; const gate = new Promise<StreamLike>((r) => (release = () => r(stream('audio')))); const deps = fakeDeps({ getLocalMedia: () => gate })
    const s = new HelmetSession('dev1', 'call', deps); const started = s.start(); deps.setBackground(true); await sleep(100); assert.equal(s.getState().status, 'requesting-media', 'still waiting for the person'); deps.setBackground(false); release(); await started; await until(() => s.getState().status === 'live'); s.end()
  })

  // =============== wording, formatting, the API ===============
  await t('every failure comes out as a sentence an operator can act on', () => {
    const named = (name: string) => Object.assign(new Error(name), { name })
    assert.match(describe(named('NotAllowedError')), /blocked.*settings/); assert.match(describe(named('NotFoundError')), /No microphone/); assert.match(describe(named('NotReadableError')), /another app/)
    assert.match(describe(new Error('Permission denied')), /microphone is blocked/, 'react-native-webrtc\'s plain permission error'); assert.match(describe(new NotReadyError('x')), /30 seconds/)
    assert.match(describe({ response: { status: 403, data: { error: 'forbidden' } } }), /open SOS alarm/, 'a refusal of this action'); assert.match(describe({ response: { status: 401 } }), /session has expired/)
    assert.equal(describe(new Error('The backend returned no stream address.')), 'The backend returned no stream address.'); assert.match(describe(null), /Something went wrong/)
  })
  await t('call time reads 83 s as 01:23, never negative, and an hour as 1:02:03', () => {
    assert.deepEqual([83_000, 0, 5_000, 59_999, 3_723_000, -4000].map(formatCallTime), ['01:23', '00:00', '00:05', '00:59', '1:02:03', '00:00'])
  })
  await t('the API: live start, call start, call stop (never throws) and end-for-everyone (does), at the backend\'s paths', async () => {
    http.calls.length = 0
    http.routes = { 'POST /devices/d1/live/start': () => ({ status: 200, data: { delivered: true, watchUrl: 'https://m/w', alreadyLive: true } }), 'POST /devices/d1/webrtc-call/start': () => ({ status: 200, data: { delivered: true, watchUrl: 'https://m/w', adminPushUrl: 'https://m/p' } }),
      'POST /devices/d1/webrtc-call/stop': () => ({ status: 500 }), 'POST /devices/d1/live/stop': () => ({ status: 500 }) }
    assert.deepEqual(await startLive('d1'), { delivered: true, watchUrl: 'https://m/w', alreadyLive: true }); assert.deepEqual(await startCall('d1'), { delivered: true, watchUrl: 'https://m/w', adminPushUrl: 'https://m/p' })
    await stopCall('d1'); assert.equal(`${http.calls.at(-1)!.method} ${http.calls.at(-1)!.url}`, 'POST /devices/d1/webrtc-call/stop', 'a failed stop is swallowed: the call still ends on this side')
    await assert.rejects(endLiveForEveryone('d1'), 'ending the stream for everyone is explicit, so a failure is shown')
    http.routes = { 'POST /devices/d1/live/start': () => ({ status: 200, data: {} }), 'POST /devices/d1/webrtc-call/start': () => ({ status: 200, data: null }) }
    assert.deepEqual(await startLive('d1'), { delivered: false, watchUrl: '', alreadyLive: false }, 'an empty answer is "not delivered", never a connection'); assert.deepEqual(await startCall('d1'), { delivered: false, watchUrl: '', adminPushUrl: '' })
  })
  await t('a real build offers live view and calls only when switched on', () => { assert.equal(liveAvailable(), false) })
}
main().then(report)
