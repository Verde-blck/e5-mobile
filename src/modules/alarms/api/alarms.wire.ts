// Values arrive exactly as the helmet protocol wrote them (numbers and codes as strings) and
// are converted once, in alarms.api.ts, so nothing downstream handles raw strings.

export interface ApiAlarm {
  id: number
  deviceId: string
  alarmType?: string | null
  latitude?: string | null
  longitude?: string | null
  occurredAt?: string | null
  resolved?: boolean
}

export interface ApiAlarmPhoto {
  id: number
  deviceId: string
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
  recordedAt?: string | null
  recordedDate?: string | null
  uploadedAt?: string | null
  alarmId?: number | null
}

export interface ApiAlarmDetail extends ApiAlarm {
  photos?: ApiAlarmPhoto[]
  videos?: ApiAlarmVideo[]
}
