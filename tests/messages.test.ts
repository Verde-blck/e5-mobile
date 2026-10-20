import assert from 'node:assert/strict'
import { fetchMessages, sendVoiceMessage, toMessage } from '@/modules/messaging/api/messages.api'
import { toneDataUri, toneWavBytes } from '@/modules/messaging/lib/tone'
import type { RecordedAudio } from '@/shared/hooks/useRecorder'
import { createRunner, installHttp } from './harness'

// Run with EXPO_PUBLIC_BROADCAST_ENABLED=true (see run.mjs): the switch that lets a real build send.
const { t, report } = createRunner()
const http = installHttp()
const audio = (): RecordedAudio => ({ uri: 'file:///cache/message-1.m4a', name: 'message-1.m4a', mimeType: 'audio/mp4', size: 3000, file: new Blob([new Uint8Array(3000)], { type: 'audio/mp4' }) })

async function main() {
  await t('a conversation is read as the web reads it: GET /devices/{id}/messages, 50 newest, shown oldest first', async () => {
    http.calls.length = 0
    http.routes = { 'GET /devices/d1/messages': () => ({ status: 200, data: { content: [
      { id: 3, deviceId: 'd1', direction: 'TO_HELMET', audioUrl: 'https://x/3.mp3', createdAt: '2026-10-20T10:30:00Z' },
      { id: 1, deviceId: 'd1', direction: 'TO_HELMET', audioUrl: 'https://x/1.mp3', createdAt: '2026-10-20T08:00:00Z' },
      { id: 2, deviceId: 'd1', direction: 'FROM_HELMET', audioUrl: 'https://x/2.amr', createdAt: '2026-10-20T09:00:00Z' },
    ] } }) }
    const messages = await fetchMessages('d1')
    assert.deepEqual(http.calls[0].params, { page: 0, size: 50 }); assert.deepEqual(messages.map((m) => m.id), [1, 2, 3], 'oldest at the top, as a conversation reads')
    assert.equal(messages[1].direction, 'FROM_HELMET'); assert.equal(messages[1].audioUrl, 'https://x/2.amr'); assert.ok(messages[0].createdAt < messages[2].createdAt && messages[0].createdAt > 0)
  })
  await t('a message with gaps gets safe defaults: sent to the helmet, no link (shown as gone), time 0', () => {
    assert.deepEqual(toMessage({ id: 9, deviceId: 'd' }), { id: 9, deviceId: 'd', direction: 'TO_HELMET', audioUrl: '', createdAt: 0 })
    assert.equal(toMessage({ id: 9, deviceId: 'd', audioUrl: null, direction: null }).direction, 'TO_HELMET')
  })
  await t('a failed read is an error, not an empty conversation', async () => {
    http.routes = { 'GET /devices/d1/messages': () => ({ status: 500 }) }; await assert.rejects(fetchMessages('d1'))
    http.routes = { 'GET /devices/d1/messages': () => ({ status: 403, data: { error: 'forbidden' } }) }; await assert.rejects(fetchMessages('d1'))
  })
  await t('sending to one helmet: POST /devices/{id}/messages/audio, multipart, a single `file`; it answers delivered or queued', async () => {
    http.calls.length = 0
    http.routes = { 'POST /devices/d1/messages/audio': () => ({ status: 200, data: { messageId: 12, audioUrl: 'https://x/12.mp3', delivered: false } }) }
    const result = await sendVoiceMessage('d1', audio())
    assert.equal(`${http.calls[0].method} ${http.calls[0].url}`, 'POST /devices/d1/messages/audio'); const form = http.calls[0].data as FormData
    assert.ok(form instanceof FormData); assert.deepEqual([...form.keys()], ['file'], 'nothing but the recording: the helmet is in the path'); assert.equal((form.get('file') as File).name, 'message-1.m4a'); assert.match(http.calls[0].contentType ?? '', /multipart\/form-data/)
    assert.deepEqual(result, { messageId: 12, audioUrl: 'https://x/12.mp3', delivered: false })
    http.routes = { 'POST /devices/d1/messages/audio': () => ({ status: 413 }) }; await assert.rejects(sendVoiceMessage('d1', audio()), undefined)
  })
  await t('the sample beep is a real WAV, so the sample conversation can be played', () => {
    const bytes = toneWavBytes(); const text = (o: number, n: number) => String.fromCharCode(...bytes.slice(o, o + n))
    assert.deepEqual([text(0, 4), text(8, 4), text(36, 4)], ['RIFF', 'WAVE', 'data']); assert.equal(bytes.length, 44 + Math.floor(16_000 * 0.6) * 2)
    const uri = toneDataUri(); assert.match(uri, /^data:audio\/wav;base64,UklGR/, 'base64 of "RIFF"'); assert.equal(Buffer.from(uri.split(',')[1], 'base64').length, bytes.length, 'it decodes back to the same bytes')
  })
}
main().then(report)
