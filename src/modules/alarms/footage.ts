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
  /**
   * "22:35" — the helmet's own clock, exactly as the API gave it. The backend
   * sends this timestamp without a timezone, so converting it to a moment in
   * time would be a guess; it's shown as a clock reading instead.
   */
  recordedClock?: string
}

export interface AlarmDetail {
  alarm: Alarm
  photos: AlarmPhoto[]
  videos: AlarmVideo[]
}

/**
 * The alarms the backend captures footage for: SOS (7), fall or impact (4) and
 * near live electricity (11). The SOS *button* (manual_sos_button) isn't
 * included yet — recording its call is the backend's next step.
 */
export function expectsFootage(type: AlarmType): boolean {
  return type === 'sos' || type === 'fall' || type === 'near-electric'
}

/**
 * Clips reach the server about 35 minutes after the alarm, longer on a weak
 * connection. Three hours is generous enough that "still uploading" is
 * believable, and short enough that an alarm with nothing linked eventually
 * says so instead of promising footage forever.
 */
export const FOOTAGE_UPLOAD_WINDOW_MS = 3 * 60 * 60_000

export type VideoStatus = 'ready' | 'uploading' | 'none'

export function videoStatus(detail: AlarmDetail, now: number): VideoStatus {
  if (detail.videos.length > 0) return 'ready'
  if (!expectsFootage(detail.alarm.type)) return 'none'
  return now - detail.alarm.raisedAt < FOOTAGE_UPLOAD_WINDOW_MS ? 'uploading' : 'none'
}

/** How often to re-check while footage is still on its way (the backend's advice). */
export const FOOTAGE_POLL_MS = 30_000
