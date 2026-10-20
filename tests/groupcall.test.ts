import assert from 'node:assert/strict'
import { BroadcastUnavailable, broadcastAvailable, buildBroadcastForm, sendBroadcast } from '@/modules/group-call/api/broadcast.api'
import { allFailed, describeOutcome, summarize, toOutcomes } from '@/modules/group-call/lib/outcomes'
import { MAX_MESSAGE_SECONDS, reachableDevices, sendLabel, toggleId } from '@/modules/group-call/lib/roster'
import type { RecordedAudio } from '@/shared/hooks/useRecorder'
import { createRunner, installHttp } from './harness'

// Run with EXPO_PUBLIC_BROADCAST_ENABLED=true (see run.mjs): the switch that lets a real build send.
const { t, report } = createRunner()
const http = installHttp()
const audio = (name = 'message-20261020101500.m4a'): RecordedAudio => ({ uri: 'file:///cache/' + name, name, mimeType: 'audio/mp4', size: 4000, file: new Blob([new Uint8Array(4000)], { type: 'audio/mp4' }) })
const fleet = [{ id: 'a', name: 'Alpha', active: true }, { id: 'b', name: 'Bravo', active: false }, { id: 'c', name: 'Charlie', active: true }, { id: 'd', name: 'Delta', active: true }]

async function main() {
  await t('a message goes to the chosen helmets that are not deactivated (offline ones are kept: they get it on reconnect)', () => {
    assert.deepEqual(reachableDevices(fleet, ['a', 'b', 'c']).map((d) => d.id), ['a', 'c'], 'Bravo is deactivated: skipped')
    assert.deepEqual(reachableDevices(fleet, []).map((d) => d.id), []); assert.deepEqual(reachableDevices(fleet, ['d', 'a']).map((d) => d.id), ['a', 'd'], 'in fleet order')
    assert.deepEqual(reachableDevices(fleet, ['zzz']).map((d) => d.id), [], 'an unknown id is not a helmet')
  })
  await t('choosing helmets toggles them; the Send button says how many will get it', () => {
    assert.deepEqual(toggleId(['a'], 'b'), ['a', 'b']); assert.deepEqual(toggleId(['a', 'b'], 'a'), ['b']); assert.deepEqual(toggleId([], 'a'), ['a'])
    assert.equal(sendLabel(3, false), 'Send to 3'); assert.equal(sendLabel(1, false), 'Send to 1'); assert.equal(sendLabel(3, true), 'Sending…'); assert.equal(MAX_MESSAGE_SECONDS, 60)
  })
  await t('the result is per helmet: played, queued for reconnect, or not sent; one missing from the answer is a failure, not a gap', () => {
    const targets = [{ id: 'a', name: 'Alpha' }, { id: 'c', name: 'Charlie' }, { id: 'd', name: 'Delta' }]
    const outcomes = toOutcomes(targets, [{ deviceId: 'c', delivered: false }, { deviceId: 'a', delivered: true }])
    assert.deepEqual(outcomes, [{ deviceId: 'a', deviceName: 'Alpha', status: 'sent' }, { deviceId: 'c', deviceName: 'Charlie', status: 'queued' }, { deviceId: 'd', deviceName: 'Delta', status: 'failed' }], 'in the order chosen, with names')
    assert.deepEqual(allFailed(targets).map((o) => o.status), ['failed', 'failed', 'failed'])
    assert.equal(toOutcomes([], []).length, 0)
  })
  await t('what each result says, and the headline over the list', () => {
    assert.deepEqual((['sent', 'queued', 'failed'] as const).map(describeOutcome), ['played', 'offline, will play when it reconnects', 'not sent'])
    assert.equal(summarize([{ deviceId: '1', deviceName: 'A', status: 'sent' }, { deviceId: '2', deviceName: 'B', status: 'sent' }, { deviceId: '3', deviceName: 'C', status: 'queued' }, { deviceId: '4', deviceName: 'D', status: 'failed' }]), '2 played, 1 will play on reconnect, 1 not sent')
    assert.equal(summarize([{ deviceId: '1', deviceName: 'A', status: 'sent' }]), '1 played'); assert.equal(summarize([]), '')
  })

  // ---- the request, exactly as the web sends it (sent only when the switch is on) ----
  await t('with the switch on, the message goes in ONE multipart request: the file, and deviceIds as one comma-joined string', async () => {
    assert.equal(broadcastAvailable(), true)
    http.calls.length = 0
    http.routes = { 'POST /broadcast': () => ({ status: 200, data: { helmets: [{ deviceId: 'a', delivered: true, messageId: 7 }, { deviceId: 'c', delivered: false, messageId: 8 }] } }) }
    const deliveries = await sendBroadcast(['a', 'c'], audio())
    assert.equal(http.calls.length, 1, 'one request, however many helmets'); assert.equal(`${http.calls[0].method} ${http.calls[0].url}`, 'POST /broadcast')
    const form = http.calls[0].data as FormData
    assert.ok(form instanceof FormData); assert.deepEqual([...form.keys()], ['file', 'deviceIds']); assert.equal(form.get('deviceIds'), 'a,c', 'ONE string, comma-joined (not one entry per helmet)'); assert.equal((form.get('file') as File).name, 'message-20261020101500.m4a')
    assert.match(http.calls[0].contentType ?? '', /multipart\/form-data/)
    assert.deepEqual(deliveries, [{ deviceId: 'a', delivered: true, messageId: 7 }, { deviceId: 'c', delivered: false, messageId: 8 }])
  })
  await t('the answer is { helmets: [...] }; "delivered" must be exactly true, and anything else is not a success', async () => {
    http.routes = { 'POST /broadcast': () => ({ status: 200, data: { helmets: [{ deviceId: 'a', delivered: 'yes' }, { deviceId: 'b', delivered: true }] } }) }
    assert.deepEqual((await sendBroadcast(['a', 'b'], audio())).map((d) => d.delivered), [false, true], 'a truthy string is not a delivery')
    http.routes = { 'POST /broadcast': () => ({ status: 200, data: {} }) }; assert.deepEqual(await sendBroadcast(['a'], audio()), [], 'an empty answer means every helmet is "not sent"')
    http.routes = { 'POST /broadcast': () => ({ status: 200, data: [{ deviceId: 'a', delivered: true }] }) }; assert.deepEqual(await sendBroadcast(['a'], audio()), [], 'a bare list is not the web\'s answer shape')
    http.routes = { 'POST /broadcast': () => ({ status: 500 }) }; await assert.rejects(sendBroadcast(['a'], audio()))
    http.routes = { 'POST /broadcast': () => ({ status: 403, data: { error: 'forbidden' } }) }; await assert.rejects(sendBroadcast(['a'], audio()))
  })
  await t('an empty selection is never sent: leaving deviceIds out would send to EVERY active helmet, so no request is made at all', async () => {
    http.calls.length = 0; http.routes = { 'POST /broadcast': () => ({ status: 200, data: { helmets: [] } }) }
    assert.deepEqual(await sendBroadcast([], audio()), []); assert.equal(http.calls.length, 0, 'no request')
  })
  await t('the form can be built without sending anything', () => {
    const form = buildBroadcastForm(['x', 'y', 'z'], audio('m.m4a')); assert.equal(form.get('deviceIds'), 'x,y,z'); assert.ok(form.has('file'))
  })
}
main().then(report)
