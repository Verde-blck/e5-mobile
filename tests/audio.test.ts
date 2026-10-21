import assert from 'node:assert/strict'
import { describeUploadError } from '@/shared/lib/uploadError'
import { TARGET_SAMPLE_RATE, downmix, encodeWav, resample } from '@/shared/lib/wav'
import { extensionFor } from '@/shared/lib/webAudio'
import { createRunner } from './harness'

const { t, report } = createRunner()
const text = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.slice(o, o + n))
const http = (status: number, data?: unknown) => ({ message: `Request failed with status code ${status}`, response: { status, data } })

async function main() {
  await t('a WAV file has the right header and size: RIFF/WAVE, PCM, mono, 16 kHz, 16-bit, and the data length matches', () => {
    const wav = encodeWav(new Float32Array(1600), TARGET_SAMPLE_RATE); const v = new DataView(wav.buffer)
    assert.deepEqual([text(wav, 0, 4), text(wav, 8, 4), text(wav, 12, 4), text(wav, 36, 4)], ['RIFF', 'WAVE', 'fmt ', 'data']); assert.equal(wav.length, 44 + 1600 * 2)
    assert.deepEqual([v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true), v.getUint16(34, true), v.getUint32(40, true), v.getUint32(4, true)], [1, 1, 16000, 16, 3200, 36 + 3200])
  })
  await t('samples are clamped, not wrapped: a too-loud sample never flips sign', () => {
    const v = new DataView(encodeWav(new Float32Array([2, -2, 0.5, -0.5, 0]), 16000).buffer)
    assert.deepEqual([44, 46, 48, 50, 52].map((o) => v.getInt16(o, true)), [32767, -32768, 16383, -16384, 0])
  })
  await t('stereo is mixed to mono by averaging, and mono is left alone', () => {
    assert.deepEqual([...downmix([new Float32Array([1, 0, -1]), new Float32Array([0, 1, -1])])], [0.5, 0.5, -1]); const mono = new Float32Array([0.1, 0.2]); assert.equal(downmix([mono]), mono)
  })
  await t('resampling keeps the duration: 48 kHz to 16 kHz is a third as many samples, and the same rate is untouched', () => {
    assert.equal(resample(new Float32Array(48_000), 48_000, 16_000).length, 16_000); assert.equal(resample(new Float32Array(44_100), 44_100, 16_000).length, 16_000)
    const same = new Float32Array(10); assert.equal(resample(same, 16_000, 16_000), same)
    const ramp = resample(new Float32Array([0, 1, 2, 3, 4, 5]), 6, 3); assert.deepEqual([...ramp], [0, 2, 4], 'every second sample: six samples at half the rate is three')
  })
  await t('a browser recording is named for what it is, never as m4a unless it is', () => {
    assert.deepEqual(['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/x-m4a', 'audio/mpeg', 'audio/wav', '', 'video/x-unknown'].map(extensionFor), ['webm', 'webm', 'ogg', 'm4a', 'm4a', 'mp3', 'wav', 'bin', 'bin'])
  })
  await t('"check the connection" is said ONLY when nothing came back; if the server answered, the connection was fine and its answer is given', () => {
    const none = describeUploadError({ message: 'Network Error' }); assert.match(none.message, /Couldn't reach the server/); assert.equal(none.detail, undefined)
    for (const status of [400, 401, 403, 404, 413, 415, 500, 502, 418]) assert.doesNotMatch(describeUploadError(http(status)).message, /Check the connection/, `HTTP ${status}`)
    assert.match(describeUploadError(http(500)).message, /connection is fine/)
  })
  await t('each answer says what to do, and carries the server\'s own code and words', () => {
    assert.match(describeUploadError(http(401)).message, /Sign in again/); assert.match(describeUploadError(http(403)).message, /isn't allowed/); assert.match(describeUploadError(http(413)).message, /too large.*10 MB/)
    const fmt = describeUploadError(http(415, { error: 'Unsupported audio type: audio/webm' })); assert.match(fmt.message, /didn't accept the recording.*audio format/); assert.equal(fmt.detail, 'HTTP 415: Unsupported audio type: audio/webm')
    assert.equal(describeUploadError(http(400, { message: 'file is required' })).detail, 'HTTP 400: file is required'); assert.equal(describeUploadError(http(500, 'Internal error')).detail, 'HTTP 500: Internal error')
    assert.equal(describeUploadError(http(400)).detail, 'HTTP 400', 'no words from the server: just the code'); assert.equal(describeUploadError(http(400, { error: 'x'.repeat(500) })).detail!.length, 'HTTP 400: '.length + 160, 'long answers are cut')
    assert.match(describeUploadError(http(413), 'the clip').message, /^The clip is too large/)
  })
}
main().then(report)
