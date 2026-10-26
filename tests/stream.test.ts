import assert from 'node:assert/strict'
import { backoffMs, connectAlarmStream, parseSse, type StreamStatus } from '@/modules/alarms/lib/alarmStream'
import type { ApiAlarm } from '@/modules/alarms/api/alarms.wire'
import { createRunner } from './harness'

const { t, report } = createRunner()

const enc = new TextEncoder()

function openStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start: (c) => { controller = c } })
  // Like a real fetch, aborting the request errors the body so a pending read()
  // rejects. Without this, nothing could ever interrupt a stalled read.
  const bind = (signal?: AbortSignal | null) => {
    const abort = () => { try { controller.error(new DOMException('The operation was aborted.', 'AbortError')) } catch { /* already closed */ } }
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort)
  }
  return {
    response: { status: 200, ok: true, body, json: async () => ({}), __bind: bind } as unknown as Response,
    send: (text: string) => controller.enqueue(enc.encode(text)),
    close: () => controller.close(),
    fail: (e: unknown) => controller.error(e),
  }
}
const refusal = (status: number, json?: unknown) =>
  ({ status, ok: false, body: null, json: async () => { if (json === undefined) throw new Error('no body'); return json } }) as unknown as Response

const ALARM = (id: number, extra: Partial<ApiAlarm> = {}): ApiAlarm => ({ id, deviceId: '866652022956057', alarmType: 'manual_sos_button', latitude: '6.5', longitude: '3.3', occurredAt: '2026-10-16T15:38:57Z', resolved: false, ...extra })
const frame = (event: string, alarm: ApiAlarm) => `${event === 'alarm' ? `id:${alarm.id}\n` : ''}event:${event}\ndata:${JSON.stringify(alarm)}\n\n`

type Seen = { alarms: ApiAlarm[]; updates: ApiAlarm[]; statuses: StreamStatus[]; unauthorized: number }
function harnessFor(fetchImpl: (url: string, init: RequestInit) => Promise<Response>, extra: Record<string, unknown> = {}) {
  const seen: Seen = { alarms: [], updates: [], statuses: [], unauthorized: 0 }
  let last: number | undefined
  const wrapped = async (url: string, init: RequestInit) => {
    const res = await fetchImpl(url, init)
    ;(res as unknown as { __bind?: (s?: AbortSignal | null) => void }).__bind?.(init.signal)
    return res
  }
  const connection = connectAlarmStream({
    url: 'https://api.test/alarms/stream',
    fetchImpl: wrapped as unknown as typeof fetch,
    getToken: () => 'TOKEN',
    onAlarm: (a) => seen.alarms.push(a),
    onUpdate: (a) => seen.updates.push(a),
    onStatus: (s) => { if (seen.statuses.at(-1) !== s) seen.statuses.push(s) },
    onUnauthorized: () => { seen.unauthorized++ },
    cursor: { get: () => last, set: (id) => { last = id } },
    sleep: () => new Promise((r) => setTimeout(r, 5)),
    ...extra,
  })
  return { seen, connection, cursor: () => last }
}
const until = async (cond: () => boolean, ms = 1500) => {
  const start = Date.now()
  while (!cond()) { if (Date.now() - start > ms) throw new Error('timed out waiting for condition'); await new Promise((r) => setTimeout(r, 5)) }
}

async function main() {
  await t('parseSse: Cypher\'s documented frame, with a ping before it', () => {
    const { events, rest } = parseSse(': ping\n\nid:77\nevent:alarm\ndata:{"id":77}\n\n')
    assert.deepEqual(events, [{ event: 'alarm', data: '{"id":77}', id: '77' }]); assert.equal(rest, '')
  })
  await t('parseSse: one event split across any chunk boundary comes out whole, exactly once', () => {
    const wire = frame('alarm', ALARM(77)) + frame('alarm-update', ALARM(77, { resolved: true }))
    for (let cut = 1; cut < wire.length; cut += 7) {
      let buf = ''; const got: string[] = []
      for (const piece of [wire.slice(0, cut), wire.slice(cut)]) {
        buf += piece; const p = parseSse(buf); buf = p.rest; p.events.forEach((e) => got.push(e.event))
      }
      assert.deepEqual(got, ['alarm', 'alarm-update'], `cut at ${cut}`)
    }
  })
  await t('parseSse: several events in one chunk, CRLF line endings, multi-line data, no event name', () => {
    assert.equal(parseSse(frame('alarm', ALARM(1)) + frame('alarm', ALARM(2))).events.length, 2)
    assert.equal(parseSse('event:alarm\r\ndata:{"id":3}\r\n\r\n').events[0].data, '{"id":3}')
    assert.equal(parseSse('data: a\ndata: b\n\n').events[0].data, 'a\nb')
    assert.equal(parseSse('data:x\n\n').events[0].event, 'message')
    assert.deepEqual(parseSse(': ping\n\n').events, [], 'a bare ping is not an event')
  })
  await t('backoff grows, is capped at 30 s, and has jitter', () => {
    assert.equal(backoffMs(1, 0), 2000); assert.equal(backoffMs(3, 0), 8000); assert.equal(backoffMs(20, 0), 30_000)
    assert.ok(backoffMs(2, 0.999) < 4500 && backoffMs(2, 0.999) > 4000)
  })

  await t('delivers alarm and alarm-update events, ignores pings, tracks the last alarm id', async () => {
    const s = openStream(); const reqs: Array<{ url: string; headers: Record<string, string> }> = []
    const { seen, connection, cursor } = harnessFor(async (url, init) => { reqs.push({ url, headers: init.headers as Record<string, string> }); return s.response })
    await until(() => seen.statuses.includes('open'))
    s.send(': ping\n\n' + frame('alarm', ALARM(77)).slice(0, 25)); s.send(frame('alarm', ALARM(77)).slice(25) + frame('alarm-update', ALARM(77, { resolved: true })))
    await until(() => seen.updates.length === 1)
    assert.equal(seen.alarms.length, 1); assert.equal(seen.alarms[0].id, 77); assert.equal(seen.updates[0].resolved, true); assert.equal(cursor(), 77)
    assert.equal(reqs[0].url, 'https://api.test/alarms/stream'); assert.equal(reqs[0].headers.Authorization, 'Bearer TOKEN')
    assert.equal(reqs[0].headers['Last-Event-ID'], undefined, 'nothing to catch up on at first connect')
    connection.stop(); await until(() => seen.statuses.at(-1) === 'down')
  })
  await t('when the server closes the stream (it does, every 30 min) it reconnects and sends Last-Event-ID', async () => {
    const first = openStream(); const second = openStream(); const reqs: Array<Record<string, string>> = []
    const streams = [first, second]
    const { seen, connection } = harnessFor(async (_u, init) => { reqs.push(init.headers as Record<string, string>); return streams[Math.min(reqs.length - 1, 1)].response })
    await until(() => seen.statuses.includes('open')); first.send(frame('alarm', ALARM(77))); await until(() => seen.alarms.length === 1)
    first.close()
    await until(() => reqs.length === 2)
    assert.equal(reqs[1]['Last-Event-ID'], '77', 'the reconnect must ask for what it missed')
    second.send(frame('alarm', ALARM(78))); await until(() => seen.alarms.length === 2)
    assert.deepEqual(seen.alarms.map((a) => a.id), [77, 78]); connection.stop()
  })
  await t('a network failure is retried; a later success delivers events', async () => {
    const s = openStream(); let n = 0
    const { seen, connection } = harnessFor(async () => { if (++n < 3) throw new TypeError('Network request failed'); return s.response })
    await until(() => seen.statuses.includes('open')); assert.equal(n, 3)
    s.send(frame('alarm', ALARM(5))); await until(() => seen.alarms.length === 1); connection.stop()
  })
  await t('a 401 ends the session once and stops; it does not hammer the server', async () => {
    let n = 0
    const { seen } = harnessFor(async () => { n++; return refusal(401) })
    await until(() => seen.unauthorized === 1); await new Promise((r) => setTimeout(r, 60))
    assert.equal(n, 1); assert.equal(seen.unauthorized, 1); assert.equal(seen.statuses.at(-1), 'down')
  })
  await t('a bare 403 (expired token) ends the session; a "forbidden" 403 only marks the stream unavailable', async () => {
    let n = 0
    const bare = harnessFor(async () => { n++; return refusal(403) })
    await until(() => bare.seen.unauthorized === 1); assert.equal(n, 1)
    let m = 0
    const forbidden = harnessFor(async () => { m++; return refusal(403, { error: 'forbidden', permission: 'ALARM_RECORD' }) })
    await until(() => forbidden.seen.statuses.includes('forbidden')); await new Promise((r) => setTimeout(r, 60))
    assert.equal(m, 1, 'retrying a permission refusal can\'t help'); assert.equal(forbidden.seen.unauthorized, 0, 'and it must not sign the user out')
  })
  await t('a connection that goes silent (no data, not even pings) is torn down and re-established', async () => {
    const silent = openStream(); const live = openStream(); let n = 0
    const { seen, connection } = harnessFor(async () => (++n === 1 ? silent.response : live.response), { stallMs: 40 })
    await until(() => n === 2, 2000); await until(() => seen.statuses.filter((s) => s === 'open').length === 2)
    live.send(frame('alarm', ALARM(9))); await until(() => seen.alarms.length === 1); connection.stop()
  })
  await t('a malformed event is skipped and the connection carries on', async () => {
    const s = openStream(); const { seen, connection } = harnessFor(async () => s.response)
    await until(() => seen.statuses.includes('open'))
    s.send('event:alarm\ndata:{not json\n\n' + frame('alarm', ALARM(11))); await until(() => seen.alarms.length === 1)
    assert.equal(seen.alarms[0].id, 11); connection.stop()
  })
  await t('stop() ends delivery and leaves the status down', async () => {
    const s = openStream(); const { seen, connection } = harnessFor(async () => s.response)
    await until(() => seen.statuses.includes('open')); connection.stop(); await until(() => seen.statuses.at(-1) === 'down')
    try { s.send(frame('alarm', ALARM(99))) } catch { /* the controller may already be closed */ }
    await new Promise((r) => setTimeout(r, 40)); assert.equal(seen.alarms.length, 0)
  })
  await t('no token -> does not connect', async () => {
    let n = 0
    const { seen } = harnessFor(async () => { n++; return refusal(500) }, { getToken: () => null })
    await until(() => seen.statuses.at(-1) === 'down'); assert.equal(n, 0)
  })
}

main().then(report)
