import assert from 'node:assert/strict'
import { fetchMedia, fetchVideoCalendar, recordedAtFromFileName, toPhoto, toVideo } from '@/modules/media/api/media.api'
import { clampDays, refreshAndWait, requestHelmetUpload, toReport } from '@/modules/media/api/localVideos.api'
import { dayKey, monthCells, monthKey, shiftMonth } from '@/modules/media/lib/calendar'
import { photoColumns } from '@/modules/media/lib/layout'
import { dayBounds, formatBytes, formatDuration } from '@/modules/media/types'
import { createRunner, installHttp } from './harness'

const { t, report } = createRunner()
const http = installHttp()
const page = (content: unknown[], last = true) => ({ content, last, totalElements: content.length, totalPages: 1, number: 0, size: 100, first: true, empty: !content.length })
const local = (y: number, mo: number, d: number, h = 12, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime()

async function main() {
  // =============== what the backend sends, turned into items ===============
  await t('a photo with a real link is available; the placeholder text the backend stores before the upload is "uploading", never a broken picture', () => {
    const ok = toPhoto({ id: 5, deviceId: '866652022956404', imageUrl: 'https://r2.example/p5.jpg', latitude: '6.45', longitude: '3.39', capturedAt: '2026-10-20T10:00:00' })
    assert.deepEqual([ok.status, ok.url, ok.thumbnailUrl, ok.id, ok.kind, ok.lat, ok.lng, ok.deviceName], ['available', 'https://r2.example/p5.jpg', 'https://r2.example/p5.jpg', '5', 'photo', 6.45, 3.39, '…56404'])
    const pending = toPhoto({ id: 6, deviceId: 'd', imageUrl: 'pending/placeholder.jpg' }); assert.deepEqual([pending.status, pending.url, pending.thumbnailUrl], ['uploading', undefined, undefined])
    assert.equal(toPhoto({ id: 7, deviceId: 'd' }).status, 'uploading', 'no link at all')
  })
  await t('a video is "ready" only with a real link (rows exist once the upload finished, so no link means failed); its id is prefixed so it never meets a photo id', () => {
    const ok = toVideo({ id: 9, deviceId: 'd1', videoUrl: 'https://r2.example/v.mp4', fileName: '20261020120610_sos_call.mp4', fileSizeBytes: '23242956', recordedAt: '2026-10-20T12:06:10', uploadedAt: '2026-10-20T12:20:00' })
    assert.deepEqual([ok.id, ok.kind, ok.status, ok.sizeBytes, ok.fileName], ['v9', 'video', 'available', 23242956, '20261020120610_sos_call.mp4']); assert.equal(ok.capturedAt, local(2026, 10, 20, 12, 6, 10), 'the helmet\'s own clock, read as local time')
    assert.equal(toVideo({ id: 1, deviceId: 'd', videoUrl: '' }).status, 'failed'); assert.equal(toVideo({ id: 1, deviceId: 'd', videoUrl: 'not a url' }).status, 'failed')
  })
  await t('when a clip has no recording time, it is read from its name (the helmet names it for the moment recording started), then the upload time', () => {
    assert.equal(recordedAtFromFileName('20260831130152.mp4'), local(2026, 8, 31, 13, 1, 52)); assert.equal(recordedAtFromFileName('20261020120610_sos_call.mp4'), local(2026, 10, 20, 12, 6, 10))
    assert.equal(recordedAtFromFileName('nonsense.mp4'), undefined); assert.equal(recordedAtFromFileName(null), undefined)
    assert.equal(toVideo({ id: 2, deviceId: 'd', videoUrl: 'https://x/v.mp4', fileName: '20260831130152.mp4' }).capturedAt, local(2026, 8, 31, 13, 1, 52))
    assert.equal(toVideo({ id: 3, deviceId: 'd', videoUrl: 'https://x/v.mp4', fileName: 'x.mp4', uploadedAt: '2026-09-01T00:00:00' }).capturedAt, local(2026, 9, 1, 0, 0, 0), 'then the upload time')
  })
  await t('sizes and lengths read the way the web shows them', () => {
    assert.deepEqual([undefined, 0, 900, 2048, 5 * 1024 * 1024, 22.2 * 1024 * 1024].map((b) => formatBytes(b as number | undefined)), [null, '0 B', '900 B', '2 KB', '5.0 MB', '22.2 MB'])
    assert.deepEqual([undefined, 0, 59_000, 83_000, 3_725_000].map((m) => formatDuration(m as number | undefined)), [null, '0:00', '0:59', '1:23', '62:05'])
    const b = dayBounds('2026-10-20'); assert.deepEqual([b.from, b.to], [local(2026, 10, 20, 0, 0, 0), new Date('2026-10-20T23:59:59.999').getTime()])
  })

  // =============== listing: one request per helmet ===============
  await t('"all devices" asks every helmet separately (there is no fleet-wide list), for photos and videos, and puts the newest first', async () => {
    http.calls.length = 0
    http.routes = {
      'GET /devices': () => ({ status: 200, data: [{ deviceId: 'a', name: 'Alpha' }, { deviceId: 'b', name: 'Bravo' }] }),
      'GET /devices/a/photos': () => ({ status: 200, data: page([{ id: 1, deviceId: 'a', imageUrl: 'https://x/1.jpg', capturedAt: '2026-10-20T10:00:00' }]) }),
      'GET /devices/b/photos': () => ({ status: 200, data: page([{ id: 2, deviceId: 'b', imageUrl: 'https://x/2.jpg', capturedAt: '2026-10-20T11:00:00' }]) }),
      'GET /devices/a/videos': () => ({ status: 200, data: page([{ id: 3, deviceId: 'a', videoUrl: 'https://x/3.mp4', recordedAt: '2026-10-20T12:00:00' }]) }),
      'GET /devices/b/videos': () => ({ status: 200, data: page([]) }),
    }
    const all = await fetchMedia({}); assert.deepEqual(all.map((m) => m.id), ['v3', '2', '1'], 'newest first, both kinds'); assert.equal(http.calls.filter((c) => /photos|videos/.test(c.url ?? "")).length, 4, 'two helmets x two kinds')
    http.calls.length = 0; const photos = await fetchMedia({ kind: 'photo' }); assert.deepEqual(photos.map((m) => m.id), ['2', '1']); assert.equal(http.calls.filter((c) => /videos/.test(c.url ?? "")).length, 0, 'photos only asks for photos')
    http.calls.length = 0; await fetchMedia({ kind: 'video', deviceId: 'a' }); assert.deepEqual(http.calls.map((c) => `${c.method} ${c.url}`), ['GET /devices/a/videos'], 'one helmet, one request, no device list')
  })
  await t('videos are filtered by recording day on the server (from and to), and every kind is filtered by the day here too', async () => {
    http.calls.length = 0
    http.routes = { 'GET /devices/a/videos': () => ({ status: 200, data: page([{ id: 1, deviceId: 'a', videoUrl: 'https://x/1.mp4', recordedAt: '2026-10-20T09:00:00' }, { id: 2, deviceId: 'a', videoUrl: 'https://x/2.mp4', recordedAt: '2026-10-19T23:59:00' }]) }) }
    const got = await fetchMedia({ kind: 'video', deviceId: 'a', date: '2026-10-20' }); assert.deepEqual(got.map((m) => m.id), ['v1'], 'a clip from the day before is dropped'); assert.deepEqual(http.calls[0].params, { from: '2026-10-20', to: '2026-10-20', page: 0, size: 100 })
  })
  await t('a file name search matches the file name, the helmet\'s name or its number', async () => {
    http.routes = { 'GET /devices/a/videos': () => ({ status: 200, data: page([{ id: 1, deviceId: 'a', videoUrl: 'https://x/1.mp4', fileName: '20261020_sos_call.mp4', recordedAt: '2026-10-20T09:00:00' }, { id: 2, deviceId: 'a', videoUrl: 'https://x/2.mp4', fileName: '20261020.mp4', recordedAt: '2026-10-20T08:00:00' }]) }) }
    assert.deepEqual((await fetchMedia({ kind: 'video', deviceId: 'a', search: 'SOS' })).map((m) => m.id), ['v1'], 'not case sensitive'); assert.equal((await fetchMedia({ kind: 'video', deviceId: 'a', search: 'nothing' })).length, 0)
  })
  await t('one helmet failing never blanks the gallery', async () => {
    http.routes = { 'GET /devices': () => ({ status: 200, data: [{ deviceId: 'a' }, { deviceId: 'b' }] }), 'GET /devices/a/photos': () => ({ status: 500 }), 'GET /devices/b/photos': () => ({ status: 200, data: page([{ id: 2, deviceId: 'b', imageUrl: 'https://x/2.jpg', capturedAt: '2026-10-20T11:00:00' }]) }) }
    assert.deepEqual((await fetchMedia({ kind: 'photo' })).map((m) => m.id), ['2'])
  })
  await t('a helmet with more than one page of clips is read page by page, to a limit', async () => {
    let n = 0; http.calls.length = 0
    http.routes = { 'GET /devices/a/videos': () => { n += 1; return { status: 200, data: page([{ id: n, deviceId: 'a', videoUrl: 'https://x/v.mp4', recordedAt: `2026-10-${10 + n}T09:00:00` }], n >= 3) } } }
    assert.equal((await fetchMedia({ kind: 'video', deviceId: 'a' })).length, 3, 'three pages'); assert.deepEqual(http.calls.map((c) => (c.params as { page: number }).page), [0, 1, 2])
    n = -100; http.calls.length = 0; http.routes = { 'GET /devices/a/videos': () => { n += 1; return { status: 200, data: page([{ id: 1000 + n, deviceId: 'a', videoUrl: 'https://x/v.mp4', recordedAt: '2026-10-01T09:00:00' }], false) } } }
    await fetchMedia({ kind: 'video', deviceId: 'a' }); assert.equal(http.calls.length, 5, 'stops at five pages however many there are')
  })

  // =============== the calendar ===============
  await t('the calendar adds up every helmet\'s days, and a helmet that fails just leaves its days out', async () => {
    http.routes = {
      'GET /devices': () => ({ status: 200, data: [{ deviceId: 'a' }, { deviceId: 'b' }, { deviceId: 'c' }] }),
      'GET /devices/a/videos/calendar': () => ({ status: 200, data: { days: [{ date: '2026-10-19', count: 9, totalBytes: 100 }, { date: '2026-10-20', count: '3', totalBytes: '50' }] } }),
      'GET /devices/b/videos/calendar': () => ({ status: 200, data: { days: [{ date: '2026-10-20', count: 2, totalBytes: 25 }] } }),
      'GET /devices/c/videos/calendar': () => ({ status: 500 }),
    }
    const cal = await fetchVideoCalendar('2026-10'); assert.deepEqual(cal, { month: '2026-10', totalClips: 14, days: { '2026-10-19': { count: 9, totalBytes: 100 }, '2026-10-20': { count: 5, totalBytes: 75 } } })
    http.calls.length = 0; await fetchVideoCalendar('2026-10', 'a'); assert.deepEqual(http.calls.map((c) => `${c.url} ${JSON.stringify(c.params)}`), ['/devices/a/videos/calendar {"month":"2026-10"}'])
  })
  await t('the month grid starts on Monday, has blanks before the 1st and rows of seven', () => {
    const oct = monthCells('2026-10'); assert.equal(oct.length % 7, 0); assert.deepEqual(oct.slice(0, 5), [null, null, null, 1, 2], 'October 2026 starts on a Thursday'); assert.equal(oct.filter((c) => c !== null).length, 31)
    assert.equal(monthCells('2026-06')[0], 1, 'June 2026 starts on a Monday: no blanks'); assert.equal(monthCells('2026-02').filter((c) => c !== null).length, 28); assert.equal(monthCells('2028-02').filter((c) => c !== null).length, 29, 'a leap year')
    assert.deepEqual([shiftMonth('2026-01', -1), shiftMonth('2026-12', 1), shiftMonth('2026-10', 0), shiftMonth('2026-03', -14)], ['2025-12', '2027-01', '2026-10', '2025-01']); assert.equal(dayKey('2026-10', 5), '2026-10-05'); assert.equal(monthKey(new Date(2026, 9, 21)), '2026-10')
  })

  // =============== recordings still on the helmet ===============
  await t('the helmet\'s report is read safely: files without a name are dropped, and only an explicit "uploaded: true" counts', () => {
    const r = toReport({ reportedAt: '2026-10-20T10:00:00', files: [{ fileName: 'a.mp4', recordedAt: '2026-10-20T09:00:00', uploaded: true }, { fileName: 'b.mp4', uploaded: 'yes' as never, uploadRequestedAt: '2026-10-20T09:30:00' }, { recordedAt: '2026-10-20T08:00:00' }] })
    assert.deepEqual(r.files.map((f) => [f.fileName, f.uploaded, f.uploadRequestedAt !== null]), [['a.mp4', true, false], ['b.mp4', false, true]]); assert.deepEqual(toReport(null), { reportedAt: null, files: [] })
  })
  await t('the look-back is always between 1 and 90 days', () => { assert.deepEqual([0, -5, 1, 7.4, 90, 400].map(clampDays), [1, 1, 1, 7, 90, 90]) })
  await t('asking the helmet: "refresh" then poll for a NEWER report; an offline helmet is reported at once; no answer in time returns none', async () => {
    let reported: string | null = '2026-10-20T09:00:00'; let polls = 0; http.calls.length = 0
    http.routes = { 'POST /devices/h/local-videos/refresh': () => ({ status: 200, data: { delivered: true } }), 'GET /devices/h/local-videos': () => { polls += 1; if (polls >= 3) reported = '2026-10-20T10:00:00'; return { status: 200, data: { reportedAt: reported, files: [{ fileName: 'n.mp4', uploaded: false }] } } } }
    const ok = await refreshAndWait('h', 7, new AbortController().signal, { intervalMs: 5, giveUpMs: 500 }); assert.equal(ok.delivered, true); assert.equal(ok.report?.files[0].fileName, 'n.mp4'); assert.deepEqual(http.calls.find((c) => (c.url ?? "").endsWith("/refresh"))!.params, { days: 7 })
    http.routes = { 'POST /devices/off/local-videos/refresh': () => ({ status: 200, data: { delivered: false } }), 'GET /devices/off/local-videos': () => ({ status: 200, data: { reportedAt: null, files: [] } }) }
    assert.deepEqual(await refreshAndWait('off', 7, new AbortController().signal, { intervalMs: 5, giveUpMs: 100 }), { delivered: false, report: null })
    http.routes = { 'POST /devices/slow/local-videos/refresh': () => ({ status: 200, data: { delivered: true } }), 'GET /devices/slow/local-videos': () => ({ status: 200, data: { reportedAt: '2026-10-20T09:00:00', files: [] } }) }
    assert.equal((await refreshAndWait('slow', 7, new AbortController().signal, { intervalMs: 5, giveUpMs: 60 })).report, null, 'the same old report is not an answer')
    const stop = new AbortController(); const p = refreshAndWait('slow', 7, stop.signal, { intervalMs: 5, giveUpMs: 5000 }); setTimeout(() => stop.abort(), 30); assert.equal((await p).report, null, 'leaving the screen stops the waiting')
  })
  await t('asking for uploads: named files or everything, in the shape the backend expects; "queued" (not delivered) still counts as accepted', async () => {
    http.calls.length = 0; http.routes = { 'POST /devices/h/local-videos/upload': (c) => ({ status: 200, data: (c.data as { all?: boolean }).all ? { delivered: false } : {} }) }
    assert.deepEqual(await requestHelmetUpload('h', { files: ['a.mp4', 'b.mp4'] }), { delivered: true }); assert.deepEqual(http.calls[0].data, { files: ['a.mp4', 'b.mp4'] })
    assert.deepEqual((await requestHelmetUpload('h', { all: true })), { delivered: false }); assert.deepEqual(http.calls[1].data, { all: true })
  })
  await t('photo tiles across: two on a phone, three on a tablet in portrait, four in landscape', () => { assert.deepEqual([300, 358, 649, 650, 800, 999, 1000, 1300].map(photoColumns), [2, 2, 2, 3, 3, 3, 4, 4]) })
}
main().then(report)
