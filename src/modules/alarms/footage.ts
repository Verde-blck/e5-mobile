import type { Alarm, AlarmType } from './types'

export interface AlarmPhoto {
  id: string
  url: string
  capturedAt?: number
  lat?: number
  lng?: number
}

export interface AlarmVideo {
  id: string
  url: string
  fileName: string
  sizeBytes?: number
  // The backend sends this timestamp without a timezone, so converting it to a
  // moment in time would be a guess; it is shown as a clock reading.
  recordedClock?: string
}

export interface AlarmDetail {
  alarm: Alarm
  photos: AlarmPhoto[]
  videos: AlarmVideo[]
}

// Only these alarm types have footage captured by the backend: SOS
// (7), fall or impact (4) and near live electricity (11).
export function expectsFootage(type: AlarmType): boolean {
  return type === 'sos' || type === 'fall' || type === 'near-electric'
}

// Three hours: long enough that "still uploading" is believable,
// short enough that an alarm with no footage eventually says so.
export const FOOTAGE_UPLOAD_WINDOW_MS = 3 * 60 * 60_000

export type VideoStatus = 'ready' | 'uploading' | 'none'

export function videoStatus(detail: AlarmDetail, now: number): VideoStatus {
  if (detail.videos.length > 0) return 'ready'
  if (!expectsFootage(detail.alarm.type)) return 'none'
  return now - detail.alarm.raisedAt < FOOTAGE_UPLOAD_WINDOW_MS ? 'uploading' : 'none'
}

export const FOOTAGE_POLL_MS = 30_000
