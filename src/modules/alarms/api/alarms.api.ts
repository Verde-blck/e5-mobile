import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { num, pageContent, shortDeviceName, ts } from '@/shared/lib/api-normalize'
import type { Page } from '@/shared/lib/api-normalize'
import { alarmTypeFromCode, severityForType } from '../types'
import type { Alarm } from '../types'
import type { AlarmDetail, AlarmPhoto, AlarmVideo } from '../footage'
import type { ApiAlarm, ApiAlarmDetail, ApiAlarmPhoto, ApiAlarmVideo } from './alarms.wire'
import { getMockAlarmDetail, getMockAlarms, setMockAlarmResolved } from './alarms.mock'

/** Used for the list, for stream events and for GET /alarms/{id}. */
export function toAlarm(api: ApiAlarm): Alarm {
  const type = alarmTypeFromCode(api.alarmType)
  return {
    id: String(api.id),
    deviceId: api.deviceId,
    // The API carries no helmet name; the screens look it up from the device
    // list by deviceId. The short IMEI is only the fallback.
    deviceName: shortDeviceName(api.deviceId),
    type,
    // Derived — the API sends no severity. See severityForType.
    severity: severityForType(type),
    status: api.resolved ? 'resolved' : 'active',
    raisedAt: ts(api.occurredAt) ?? 0,
    lat: num(api.latitude),
    lng: num(api.longitude),
  }
}

function toPhoto(api: ApiAlarmPhoto): AlarmPhoto | null {
  if (!api.imageUrl) return null
  return {
    id: String(api.id),
    url: api.imageUrl,
    capturedAt: ts(api.capturedAt),
    lat: num(api.latitude),
    lng: num(api.longitude),
  }
}

function toVideo(api: ApiAlarmVideo): AlarmVideo | null {
  if (!api.videoUrl) return null
  return {
    id: String(api.id),
    url: api.videoUrl,
    fileName: api.fileName ?? `clip-${api.id}.mp4`,
    sizeBytes: api.fileSizeBytes ?? undefined,
    recordedClock: api.recordedAt?.match(/T(\d{2}:\d{2})/)?.[1],
  }
}

export function toAlarmDetail(api: ApiAlarmDetail): AlarmDetail {
  return {
    alarm: toAlarm(api),
    photos: (api.photos ?? []).map(toPhoto).filter((p): p is AlarmPhoto => p !== null),
    // The helmet's clips are listed oldest-first by file name (a timestamp).
    videos: (api.videos ?? [])
      .map(toVideo)
      .filter((v): v is AlarmVideo => v !== null)
      .sort((a, b) => a.fileName.localeCompare(b.fileName)),
  }
}

/**
 * The endpoint is paginated and has no "all" mode, so this takes a single
 * large page. Fine at current volume; it should move to proper pagination or
 * a date filter once alarm history grows.
 */
export async function fetchAlarms(): Promise<Alarm[]> {
  if (env.useMocks) return getMockAlarms().map(toAlarm)

  const { data } = await apiClient.get<Page<ApiAlarm>>('/alarms', {
    params: { page: 0, size: 200 },
  })
  return pageContent(data).map(toAlarm)
}

/**
 * One alarm with the footage the backend linked to it (by alarmId). Needs the
 * photo/video permissions as well as alarm access; a refusal comes back as a
 * 403 {"error":"forbidden"} that the screen shows as "no access".
 */
export async function fetchAlarmDetail(id: string): Promise<AlarmDetail> {
  if (env.useMocks) {
    const mock = getMockAlarmDetail(id)
    if (!mock) throw Object.assign(new Error('HTTP 404'), { response: { status: 404 } })
    return toAlarmDetail(mock)
  }
  const { data } = await apiClient.get<ApiAlarmDetail>(`/alarms/${id}`)
  return toAlarmDetail(data)
}

/**
 * Resolve or reopen. Two endpoints rather than one with a body, which is how
 * the API models it. Every open dashboard hears about it on the stream.
 */
export async function setAlarmResolved(id: string, resolved: boolean): Promise<void> {
  if (env.useMocks) {
    setMockAlarmResolved(id, resolved)
    return
  }
  await apiClient.patch(`/alarms/${id}/${resolved ? 'resolve' : 'unresolve'}`)
}
