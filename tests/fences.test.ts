import assert from 'node:assert/strict'
import { expandPermissions } from '@/shared/constants/backend-permissions'
import { buildClipForm, clipErrorMessage, deleteFence, fenceErrorMessage, fetchFences, removeWarningAudio, saveFence, saveFenceWithClip, toBody, toDraft, toFence, uploadWarningAudio } from '@/modules/fences/api/fences.api'
import { CLIP_MAX_BYTES, clipMimeType, formatBytes, validateClip, type ClipFile } from '@/modules/fences/lib/clip'
import { removeMockClip, uploadMockClip } from '@/modules/fences/api/fences.mock'
import { deleteMockFence, getMockFences, saveMockFence } from '@/modules/fences/api/fences.mock'
import { describePeriod, distanceM, isTooSmall, narrowestAcrossM, validateDraft } from '@/modules/fences/lib/geometry'
import { EMPTY_DRAFT, MIN_FENCE_ACROSS_M, type FenceDraft } from '@/modules/fences/types'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()

const ROUND: FenceDraft = { ...EMPTY_DRAFT, name: '  Site A  ', center: { lat: 6.5244, lng: 3.3792 }, radiusMeters: 400.4, deviceIds: ['1', '2'], validPeriods: [{ start: '22:00', end: '06:00' }] }
const POLY: FenceDraft = { ...EMPTY_DRAFT, name: 'Yard', type: 'POLYGON', behavior: 'NO_ENTRY', center: null, points: [{ lat: 6.5285, lng: 3.3735 }, { lat: 6.5292, lng: 3.3762 }, { lat: 6.5271, lng: 3.3768 }] }

async function main() {
  await t('fence permissions: FENCE views, FENCE_MANAGE changes (and includes viewing); GEO_FENCE grants nothing here (the backend converts it to FENCE)', () => {
    assert.deepEqual(expandPermissions(['FENCE']), ['fences:read'])
    assert.deepEqual(expandPermissions(['FENCE_MANAGE']).sort(), ['fences:delete', 'fences:read', 'fences:write'])
    assert.deepEqual(expandPermissions(['GEO_FENCE']), [])
  })

  await t('a fence from the API: strings become numbers, "HH:mm:ss" becomes "HH:mm", junk falls back safely', () => {
    const f = toFence({ id: 7, name: 'Gate', type: 'ROUND', center: { lat: '6.5244', lng: '3.3792' }, radiusMeters: '400', behavior: 'NO_ENTRY', frequencyMinutes: 15,
      validPeriods: [{ start: '08:00:00', end: '17:30:00' }], deviceIds: [12, '13'], active: false, warningAudioUrl: 'https://x/clip.mp3' })
    assert.deepEqual([f.id, f.center, f.radiusMeters, f.behavior, f.frequencyMinutes, f.active], [7, { lat: 6.5244, lng: 3.3792 }, 400, 'NO_ENTRY', 15, false])
    assert.deepEqual(f.validPeriods, [{ start: '08:00', end: '17:30' }]); assert.deepEqual(f.deviceIds, ['12', '13']); assert.equal(f.hasWarningAudio, true)
    assert.equal(toFence({ id: 1, hasWarningAudio: true, warningAudioUrl: 'https://x/c.mp3' }).hasWarningAudio, true); assert.equal(toFence({ id: 1, hasWarningAudio: false, warningAudioUrl: null }).hasWarningAudio, false, 'null url and false flag: no clip'); assert.equal(toFence({ id: 1, warningAudioUrl: null }).hasWarningAudio, false)
    const odd = toFence({ id: 1, frequencyMinutes: 7, type: 'weird', behavior: 'weird' })
    assert.equal(odd.type, 'ROUND'); assert.equal(odd.behavior, 'FORBIDDEN_TO_LEAVE'); assert.equal(odd.frequencyMinutes, 0); assert.equal(odd.active, true, 'a fence is on unless the API says off'); assert.equal(odd.hasWarningAudio, false)
  })
  await t('list: accepts a bare array or a page', async () => {
    http.routes = { 'GET /fences': () => ({ status: 200, data: [{ id: 1, name: 'A' }] }) }; assert.equal((await fetchFences()).length, 1)
    http.routes = { 'GET /fences': () => ({ status: 200, data: { content: [{ id: 1 }, { id: 2 }] } }) }; assert.equal((await fetchFences()).length, 2)
  })
  await t('create/update send only what the guide lists, shaped by fence type; the name is trimmed, the radius rounded', async () => {
    http.calls.length = 0
    http.routes = { 'POST /fences': (r) => ({ status: 200, data: { ...r.data, id: 9 } }), 'PUT /fences/9': (r) => ({ status: 200, data: { ...r.data, id: 9 } }), 'DELETE /fences/9': () => ({ status: 204 }) }
    const saved = await saveFence(ROUND); assert.equal(saved.id, 9)
    assert.deepEqual(Object.keys(http.calls[0].data).sort(), ['active', 'behavior', 'center', 'deviceIds', 'frequencyMinutes', 'name', 'radiusMeters', 'type', 'validPeriods'])
    assert.equal(http.calls[0].data.name, 'Site A'); assert.equal(http.calls[0].data.radiusMeters, 400); assert.ok(!('points' in http.calls[0].data))
    await saveFence(POLY, 9); assert.equal(`${http.calls[1].method} ${http.calls[1].url}`, 'PUT /fences/9')
    assert.ok('points' in http.calls[1].data && !('center' in http.calls[1].data) && !('radiusMeters' in http.calls[1].data), 'a polygon sends points, not a circle')
    await deleteFence(9); assert.equal(`${http.calls[2].method} ${http.calls[2].url}`, 'DELETE /fences/9')
    assert.deepEqual((toBody(POLY) as { points?: unknown }).points, POLY.points)
  })
  await t('error text: the backend\'s own 400 message wins; a 403 says the role; otherwise something honest', () => {
    assert.equal(fenceErrorMessage({ response: { status: 400, data: { error: 'Radius must be at most 5000 m.' } } }), 'Radius must be at most 5000 m.')
    assert.match(fenceErrorMessage({ response: { status: 403, data: {} } }), /role/); assert.match(fenceErrorMessage(new Error('Network Error')), /Check your connection/)
  })
  await t('editing starts from the saved fence, without its id or clip flag', () => {
    const draft = toDraft({ ...ROUND, id: 4, hasWarningAudio: true }) as unknown as Record<string, unknown>
    assert.ok(!('id' in draft) && !('hasWarningAudio' in draft)); assert.equal(draft.name, '  Site A  ')
  })

  await t('distance: one degree of latitude is about 111 km', () => assert.ok(Math.abs(distanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111_195) < 300))
  await t('a fence under 50 m across is flagged (GPS drifts 10-50 m): circle = its diameter, polygon = its narrower side', () => {
    assert.equal(MIN_FENCE_ACROSS_M, 50)
    assert.equal(narrowestAcrossM({ type: 'ROUND', radiusMeters: 100, points: [] }), 200)
    assert.equal(isTooSmall({ type: 'ROUND', radiusMeters: 24, points: [] }), true); assert.equal(isTooSmall({ type: 'ROUND', radiusMeters: 25, points: [] }), false, 'exactly 50 m is fine')
    assert.equal(narrowestAcrossM({ type: 'POLYGON', radiusMeters: 0, points: [{ lat: 6, lng: 3 }, { lat: 6, lng: 3.001 }] }), null, 'fewer than 3 corners: nothing to measure')
    const thin = [{ lat: 6.5, lng: 3.5 }, { lat: 6.5, lng: 3.5004 }, { lat: 6.5009, lng: 3.5004 }, { lat: 6.5009, lng: 3.5 }]
    assert.equal(isTooSmall({ type: 'POLYGON', radiusMeters: 0, points: thin }), true)
  })
  await t('what stops a save, in the order a person fixes it', () => {
    assert.deepEqual(validateDraft(ROUND), [])
    assert.deepEqual(validateDraft({ ...EMPTY_DRAFT }), ['Give the fence a name.', 'Click the map to place the circle.'])
    assert.match(validateDraft({ ...ROUND, radiusMeters: 0 })[0], /more than 0 m/)
    assert.match(validateDraft({ ...POLY, points: POLY.points.slice(0, 2) })[0], /at least 3 points on the map \(2 so far\)/)
    assert.match(validateDraft({ ...ROUND, validPeriods: [{ start: '08:00', end: '08:00' }] })[0], /can.t be the same/)
    assert.match(validateDraft({ ...ROUND, validPeriods: [{ start: '8:00', end: '17:00' }] })[0], /enter both times/); assert.match(validateDraft({ ...ROUND, validPeriods: [{ start: '24:00', end: '17:00' }] })[0], /enter both times/)
    assert.deepEqual(validateDraft({ ...ROUND, validPeriods: [{ start: '22:00', end: '06:00' }] }), [], 'a period may cross midnight')
  })
  await t('an overnight period says so', () => { assert.equal(describePeriod({ start: '22:00', end: '06:00' }), '22:00 to 06:00 (overnight)'); assert.equal(describePeriod({ start: '08:00', end: '17:00' }), '08:00 to 17:00') })

  await t('sample fences: a helmet stands inside the no-entry yard; the store refuses what the backend refuses; delete works', async () => {
    const all = await getMockFences(); assert.equal(all.length, 2); assert.ok(all.some((f) => f.behavior === 'NO_ENTRY') && all.some((f) => f.type === 'ROUND'))
    await assert.rejects(saveMockFence({ ...ROUND, name: ' ' }), /needs a name/); await assert.rejects(saveMockFence({ ...ROUND, center: null }), /centre/); await assert.rejects(saveMockFence({ ...POLY, points: [] }), /3 points/)
    const created = await saveMockFence(ROUND); assert.ok(created.id > 2); assert.equal((await getMockFences()).length, 3)
    const edited = await saveMockFence({ ...ROUND, name: 'Renamed' }, created.id); assert.equal(edited.id, created.id); assert.equal((await getMockFences()).find((f) => f.id === created.id)?.name, 'Renamed')
    await deleteMockFence(created.id); assert.equal((await getMockFences()).length, 2)
  })

  const mp3 = (bytes = 2000, name = 'left-area.mp3'): ClipFile => ({ uri: 'file:///cache/' + name, name, mimeType: 'audio/mpeg', size: bytes, file: new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' }) })

  await t('which files can be a clip: MP3, WAV, M4A, AAC or 3GP by name or type, not empty, up to 5 MB', () => {
    for (const ok of [{ name: 'a.mp3' }, { name: 'A.WAV' }, { name: 'rec.m4a', mimeType: 'audio/mp4' }, { name: 'x.aac' }, { name: 'x.3gp' }, { name: 'voice', mimeType: 'audio/x-m4a' }, { name: 'voice', mimeType: 'audio/x-wav' }, { name: 'x.bin', mimeType: 'audio/mpeg' }, { name: 'a.mp3', size: CLIP_MAX_BYTES }]) assert.equal(validateClip(ok), null, JSON.stringify(ok))
    for (const bad of [{ name: 'notes.txt', mimeType: 'text/plain' }, { name: 'song.ogg', mimeType: 'audio/ogg' }, { name: 'song.flac' }, { name: 'clip.mp4', mimeType: 'video/mp4' }, { name: 'a.mp3', size: 0 }, { name: 'a.mp3', size: CLIP_MAX_BYTES + 1 }]) assert.ok(validateClip(bad), JSON.stringify(bad))
    assert.match(validateClip({ name: 'a.mp3', size: CLIP_MAX_BYTES + 1 }) ?? '', /5 MB/); assert.match(validateClip({ name: 'song.flac' }) ?? '', /MP3, WAV or M4A/)
  })
  await t('it is uploaded as what its name says, whatever vague type the picker reported', () => {
    assert.equal(clipMimeType('a.mp3', 'application/octet-stream'), 'audio/mpeg'); assert.equal(clipMimeType('a.WAV', ''), 'audio/wav'); assert.equal(clipMimeType('voice', 'audio/mpeg'), 'audio/mpeg')
    assert.deepEqual(['a.m4a', 'a.AAC', 'a.3gp', 'noext'].map((n, i) => clipMimeType(n, i === 3 ? 'audio/mp4' : '')), ['audio/mp4', 'audio/aac', 'audio/3gpp', 'audio/mp4'], 'what a tablet records is sent as what it is')
    assert.deepEqual([formatBytes(900), formatBytes(2048), formatBytes(3 * 1024 * 1024)], ['900 B', '2 KB', '3.0 MB'])
  })
  await t('upload: multipart POST to /fences/{id}/warning-audio with one field, `file`, named as chosen', async () => {
    http.calls.length = 0; http.routes = { 'POST /fences/9/warning-audio': () => ({ status: 200, data: {} }) }
    await uploadWarningAudio(9, mp3()); const call = http.calls[0]
    assert.equal(call.method, 'POST'); assert.equal(call.url, '/fences/9/warning-audio'); assert.ok(call.data instanceof FormData); assert.deepEqual([...(call.data as FormData).keys()], ['file'])
    assert.equal(((call.data as FormData).get('file') as File).name, 'left-area.mp3'); assert.match(call.contentType ?? '', /multipart\/form-data/)
    assert.ok(buildClipForm(mp3()).has('file'))
  })
  await t('remove: DELETE /fences/{id}/warning-audio', async () => {
    http.calls.length = 0; http.routes = { 'DELETE /fences/9/warning-audio': () => ({ status: 204 }) }; await removeWarningAudio(9); assert.equal(`${http.calls[0].method} ${http.calls[0].url}`, 'DELETE /fences/9/warning-audio')
  })
  await t('why an upload failed, in a sentence: too large, the backend\'s own reason, a refused role, no connection', () => {
    assert.match(clipErrorMessage({ response: { status: 413 } }), /5 MB/); assert.equal(clipErrorMessage({ response: { status: 400, data: { error: 'Not an MP3 or WAV.' } } }), 'Not an MP3 or WAV.')
    assert.match(clipErrorMessage({ response: { status: 403 } }), /role/); assert.match(clipErrorMessage(new Error('Network Error')), /Check your connection/); assert.match(fenceErrorMessage({ response: { status: 413 } }), /5 MB/)
  })
  await t('saving with a clip: the fence first (it needs an id), then the clip; no clip argument means no clip request', async () => {
    http.calls.length = 0
    http.routes = { 'POST /fences': (r) => ({ status: 200, data: { ...r.data, id: 12 } }), 'PUT /fences/12': (r) => ({ status: 200, data: { ...r.data, id: 12 } }), 'POST /fences/12/warning-audio': () => ({ status: 200, data: {} }), 'DELETE /fences/12/warning-audio': () => ({ status: 204 }) }
    const created = await saveFenceWithClip(ROUND, undefined, mp3()); assert.deepEqual(http.calls.map((c) => `${c.method} ${c.url}`), ['POST /fences', 'POST /fences/12/warning-audio']); assert.equal(created.fence.id, 12); assert.equal(created.clipError, null); assert.equal(created.fence.hasWarningAudio, true)
    http.calls.length = 0; await saveFenceWithClip(ROUND, 12, undefined); assert.deepEqual(http.calls.map((c) => `${c.method} ${c.url}`), ['PUT /fences/12'])
    http.calls.length = 0; const removed = await saveFenceWithClip(ROUND, 12, null); assert.deepEqual(http.calls.map((c) => `${c.method} ${c.url}`), ['PUT /fences/12', 'DELETE /fences/12/warning-audio']); assert.equal(removed.fence.hasWarningAudio, false)
  })
  await t('if the clip fails the fence is kept and the failure is reported on its own (so saving again edits it, not duplicates it)', async () => {
    http.routes = { 'POST /fences': (r) => ({ status: 200, data: { ...r.data, id: 13 } }), 'POST /fences/13/warning-audio': () => ({ status: 413 }) }
    const r = await saveFenceWithClip(ROUND, undefined, mp3()); assert.equal(r.fence.id, 13); assert.match(r.clipError ?? '', /5 MB/)
  })
  await t('if the fence itself is refused nothing else is attempted', async () => {
    http.calls.length = 0; http.routes = { 'POST /fences': () => ({ status: 400, data: { error: 'A fence needs a name.' } }) }
    await assert.rejects(saveFenceWithClip(ROUND, undefined, mp3())); assert.equal(http.calls.length, 1)
  })
  await t('sample data behaves the same: a clip attaches, can be removed, and an oversize or non-audio file is refused as the backend would', async () => {
    const fence = (await getMockFences())[1]; assert.equal(fence.hasWarningAudio, false)
    await uploadMockClip(fence.id, mp3()); assert.equal((await getMockFences())[1].hasWarningAudio, true)
    await removeMockClip(fence.id); assert.equal((await getMockFences())[1].hasWarningAudio, false)
    await assert.rejects(uploadMockClip(fence.id, mp3(CLIP_MAX_BYTES + 1)), (e: { response?: { status: number } }) => e.response?.status === 413)
    await assert.rejects(uploadMockClip(fence.id, { ...mp3(), name: 'notes.txt', mimeType: 'text/plain', file: undefined }), (e: { response?: { status: number } }) => e.response?.status === 400)
  })
}
main().then(report)
