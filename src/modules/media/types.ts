export type MediaKind = 'photo' | 'video'

// 'uploading' is not cosmetic: helmets buffer while offline and upload on
// reconnect, so the backend knows a file exists before the bytes have landed.
export type MediaStatus = 'uploading' | 'available' | 'failed'

export type MediaTrigger = 'manual' | 'alarm' | 'remote-command' | 'scheduled'

export interface MediaQuery {
  kind?: MediaKind
  deviceId?: string
  date?: string
  search?: string
}

export function dayBounds(date: string): { from: number; to: number } {
  return {
    from: new Date(`${date}T00:00:00`).getTime(),
    to: new Date(`${date}T23:59:59.999`).getTime(),
  }
}

export interface MediaItem {
  id: string
  deviceId: string
  deviceName: string
  site?: string
  kind: MediaKind
  status: MediaStatus
  capturedAt: number
  uploadedAt?: number
  durationMs?: number
  sizeBytes?: number
  fileName?: string
  url?: string
  thumbnailUrl?: string
  triggeredBy?: MediaTrigger
  alarmId?: string
  lat?: number
  lng?: number
}

export function formatBytes(bytes?: number): string | null {
  if (bytes == null) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDuration(ms?: number): string | null {
  if (ms == null) return null
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
