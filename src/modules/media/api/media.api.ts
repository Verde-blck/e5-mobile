import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { num, pageContent, shortDeviceName, ts } from '@/shared/lib/api-normalize'
import type { Page } from '@/shared/lib/api-normalize'
import { fetchDevices } from '@/modules/devices/api/devices.api'
import { getMockMedia } from './media.mock'
import { dayBounds } from '../types'
import type { MediaItem, MediaKind, MediaQuery } from '../types'

export interface ApiPhoto {
  id: number
  deviceId: string
  imageUrl?: string | null
  latitude?: string | null
  longitude?: string | null
  capturedAt?: string | null
}

export function toPhoto(api: ApiPhoto): MediaItem {
  // The backend currently stores a placeholder string where the URL will go, so anything that isn't
  // an absolute URL is treated as "not uploaded yet" rather than rendered as a broken image.
  const url = api.imageUrl ?? ''
  const uploaded = /^https?:\/\//i.test(url)
  return {
    id: String(api.id),
    deviceId: api.deviceId,
    deviceName: shortDeviceName(api.deviceId),
    kind: 'photo',
    status: uploaded ? 'available' : 'uploading',
    capturedAt: ts(api.capturedAt) ?? 0,
    thumbnailUrl: uploaded ? url : undefined,
    url: uploaded ? url : undefined,
    fileName: url || undefined,
    lat: num(api.latitude),
    lng: num(api.longitude),
  }
}

export interface ApiVideo {
  id: number
  deviceId: string
  videoUrl?: string | null
  fileName?: string | null
  fileSizeBytes?: number | string | null
  recordedAt?: string | null
  recordedDate?: string | null
  uploadedAt?: string | null
}

export function recordedAtFromFileName(fileName?: string | null): number | undefined {
  const m = fileName?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/)
  if (!m) return undefined
  const [, y, mo, d, h, mi, s] = m.map(Number)
  const date = new Date(y, mo - 1, d, h, mi, s)
  return Number.isNaN(date.getTime()) ? undefined : date.getTime()
}

export function toVideo(api: ApiVideo): MediaItem {
  const uploadedAt = ts(api.uploadedAt)
  const url = api.videoUrl ?? ''
  return {
    id: `v${api.id}`,
    deviceId: api.deviceId,
    deviceName: shortDeviceName(api.deviceId),
    kind: 'video',
    status: /^https?:\/\//i.test(url) ? 'available' : 'failed',
    // When the helmet recorded it, which can be days before it uploaded. recordedAt has no
    // timezone, so it parses as local time: the helmet's clock reading, shown as-is.
    capturedAt: ts(api.recordedAt) ?? recordedAtFromFileName(api.fileName) ?? uploadedAt ?? 0,
    uploadedAt,
    sizeBytes: num(api.fileSizeBytes),
    fileName: api.fileName ?? undefined,
    url: url || undefined,
  }
}

const PAGE_SIZE = 100
const MAX_PAGES = 5

async function fetchAllPages<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const items: T[] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data } = await apiClient.get<Page<T>>(path, { params: { ...params, page, size: PAGE_SIZE } })
    items.push(...pageContent(data))
    if (!data || Array.isArray(data) || data.last !== false) break
  }
  return items
}

const ENDPOINT: Record<MediaKind, { path: string; map: (raw: never) => MediaItem }> = {
  photo: { path: 'photos', map: toPhoto as (raw: never) => MediaItem },
  video: { path: 'videos', map: toVideo as (raw: never) => MediaItem },
}

export async function fetchMedia(query: MediaQuery = {}): Promise<MediaItem[]> {
  if (env.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return getMockMedia(query)
  }

  // Photos and videos are both listed per device, with no fleet-wide
  // list, so "all devices" fans out one request per helmet.
  const deviceIds = query.deviceId ? [query.deviceId] : (await fetchDevices()).map((d) => d.id)
  const kinds: MediaKind[] = query.kind ? [query.kind] : ['photo', 'video']

  const lists = await Promise.all(
    deviceIds.flatMap((id) =>
      kinds.map((kind) =>
        fetchAllPages<never>(
          `/devices/${id}/${ENDPOINT[kind].path}`,
          // Videos filter by recording date on the server (inclusive), so a day
          // with hundreds of clips doesn't page the whole history down.
          kind === 'video' && query.date ? { from: query.date, to: query.date } : {}
        )
          .then((rows) => rows.map(ENDPOINT[kind].map))
          .catch(() => [] as MediaItem[])
      )
    )
  )

  let items = lists.flat()
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

export interface CalendarDay {
  count: number
  totalBytes: number
}

export interface VideoCalendar {
  month: string
  totalClips: number
  days: Record<string, CalendarDay>
}

interface ApiCalendar {
  month?: string
  totalClips?: number
  days?: { date: string; count: number | string; totalBytes?: number | string }[]
}

export async function fetchVideoCalendar(month: string, deviceId?: string): Promise<VideoCalendar> {
  if (env.useMocks) return mockCalendar(month, deviceId)

  const deviceIds = deviceId ? [deviceId] : (await fetchDevices()).map((d) => d.id)
  const results = await Promise.all(deviceIds.map((id) => apiClient.get<ApiCalendar>(`/devices/${id}/videos/calendar`, { params: { month } }).then((res) => res.data).catch(() => null)))

  const days: Record<string, CalendarDay> = {}
  let totalClips = 0
  for (const result of results) {
    for (const day of result?.days ?? []) {
      const count = num(day.count) ?? 0
      const entry = (days[day.date] ??= { count: 0, totalBytes: 0 })
      entry.count += count
      entry.totalBytes += num(day.totalBytes) ?? 0
      totalClips += count
    }
  }
  return { month, totalClips, days }
}

function mockCalendar(month: string, deviceId?: string): VideoCalendar {
  const days: Record<string, CalendarDay> = {}
  let totalClips = 0
  for (const item of getMockMedia({ kind: 'video', deviceId })) {
    if (item.status !== 'available') continue
    const d = new Date(item.capturedAt)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!date.startsWith(month)) continue
    const entry = (days[date] ??= { count: 0, totalBytes: 0 })
    entry.count += 1
    entry.totalBytes += item.sizeBytes ?? 0
    totalClips += 1
  }
  return { month, totalClips, days }
}
