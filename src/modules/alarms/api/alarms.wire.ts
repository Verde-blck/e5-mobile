/**
 * The shapes the backend actually sends. Every value arrives as the helmet
 * protocol wrote it — numbers as strings, codes as strings — and is converted
 * once, in alarms.api.ts, so nothing else in the app sees these.
 */

/** An item of GET /api/alarms, and the `data` of every stream event. */
export interface ApiAlarm {
  id: number
  deviceId: string
  /** "7", "4"… or "manual_sos_button" / "voice_message" for backend-raised ones. */
  alarmType?: string | null
  latitude?: string | null
  longitude?: string | null
  occurredAt?: string | null
  resolved?: boolean
}

export interface ApiAlarmPhoto {
  id: number
  deviceId: string
  /** A signed link; it expires, so it's never stored. */
  imageUrl?: string | null
  latitude?: string | null
  longitude?: string | null
  alarmId?: number | null
  capturedAt?: string | null
}

export interface ApiAlarmVideo {
  id: number
  deviceId: string
  videoUrl?: string | null
  fileName?: string | null
  fileSizeBytes?: number | null
  /** The helmet's clock, with NO timezone: "2026-10-16T22:35:26". */
  recordedAt?: string | null
  recordedDate?: string | null
  uploadedAt?: string | null
  alarmId?: number | null
}

/** GET /api/alarms/{id}: the alarm plus the footage linked to it. */
export interface ApiAlarmDetail extends ApiAlarm {
  photos?: ApiAlarmPhoto[]
  videos?: ApiAlarmVideo[]
}
