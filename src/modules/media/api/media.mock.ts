import { getMockFleet } from '@/modules/devices/api/devices.mock'
import { dayBounds } from '../types'
import type { MediaItem, MediaQuery } from '../types'
import { SAMPLE_PHOTOS, SAMPLE_VIDEO } from './sampleMedia'

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

function when(daysAgo: number, hour: number, minute = 0): number {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.getTime() - daysAgo * DAY
}

function stamp(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function build(): MediaItem[] {
  const fleet = getMockFleet()
  const named = (i: number) => fleet[i % 5]
  const photos: MediaItem[] = [
    [0, 9, 12, 0], [0, 10, 40, 1], [0, 14, 5, 2], [1, 8, 30, 0], [1, 16, 45, 3], [2, 11, 0, 1], [3, 13, 20, 4], [5, 9, 50, 0], [7, 15, 10, 2], [9, 12, 0, 3],
  ].map(([daysAgo, hour, minute, device], i) => {
    const capturedAt = when(daysAgo, hour, minute)
    const picture = SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length]
    return { id: String(100 + i), deviceId: named(device).id, deviceName: named(device).name, kind: 'photo', status: 'available', capturedAt, uploadedAt: capturedAt + 60_000, thumbnailUrl: picture, url: picture, lat: 6.45, lng: 3.39 }
  })
  const waiting = named(2)
  photos.push({ id: '199', deviceId: waiting.id, deviceName: waiting.name, kind: 'photo', status: 'uploading', capturedAt: when(0, 15, 30) })

  const videos: MediaItem[] = [
    [0, 12, 6, 0, '_sos_call', 22.2], [0, 11, 54, 0, '_sos_call', 150.0], [0, 11, 43, 0, '_sos_call', 150.6], [1, 13, 15, 1, '_sos_call', 60.0], [1, 13, 5, 1, '_sos_call', 150.2],
    [1, 12, 16, 0, '_sos_control_room', 5.5], [1, 11, 59, 2, '', 43.1], [2, 9, 30, 0, '', 88.4], [4, 14, 0, 3, '', 12.7], [6, 10, 20, 1, '', 101.9], [9, 16, 40, 0, '', 64.3], [35, 10, 0, 0, '', 117.0],
  ].map(([daysAgo, hour, minute, device, suffix, mb], i) => {
    const capturedAt = when(daysAgo as number, hour as number, minute as number)
    return { id: `v${200 + i}`, deviceId: named(device as number).id, deviceName: named(device as number).name, kind: 'video' as const, status: 'available' as const, capturedAt, uploadedAt: capturedAt + 5 * 60_000, sizeBytes: Math.round((mb as number) * 1024 * 1024), fileName: `${stamp(capturedAt)}${suffix}.mp4`, url: SAMPLE_VIDEO, triggeredBy: suffix ? ('alarm' as const) : ('manual' as const) }
  })
  const uploading = named(1)
  videos.push({ id: 'v299', deviceId: uploading.id, deviceName: uploading.name, kind: 'video', status: 'uploading', capturedAt: when(0, 15, 50), fileName: `${stamp(when(0, 15, 50))}.mp4` })
  const failed = named(3)
  videos.push({ id: 'v298', deviceId: failed.id, deviceName: failed.name, kind: 'video', status: 'failed', capturedAt: when(3, 8, 5), uploadedAt: when(3, 8, 9), sizeBytes: 0, fileName: `${stamp(when(3, 8, 5))}.mp4` })
  return [...photos, ...videos]
}

export function getMockMedia(query: MediaQuery = {}): MediaItem[] {
  let items = build()
  if (query.kind) items = items.filter((m) => m.kind === query.kind)
  if (query.deviceId) items = items.filter((m) => m.deviceId === query.deviceId)
  if (query.date) {
    const { from, to } = dayBounds(query.date)
    items = items.filter((m) => m.capturedAt >= from && m.capturedAt <= to)
  }
  if (query.search) {
    const needle = query.search.trim().toLowerCase()
    items = items.filter((m) => m.fileName?.toLowerCase().includes(needle) || m.deviceName.toLowerCase().includes(needle) || m.deviceId.includes(needle))
  }
  return items.sort((a, b) => b.capturedAt - a.capturedAt)
}
