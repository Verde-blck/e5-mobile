export type MediaKind = 'photo' | 'video'

/**
 * FRD §4 Recording & Media Management. 'uploading' is not cosmetic: helmets
 * buffer while offline and upload on reconnect, so the backend knows a file
 * exists before the bytes have landed. Showing it as available would give the
 * operator a broken player.
 */
export type MediaStatus = 'uploading' | 'available' | 'failed'

export type MediaTrigger = 'manual' | 'alarm' | 'remote-command' | 'scheduled'

/** Filters sent to the API and used as the cache key. */
export interface MediaQuery {
  /** Omit to fetch both kinds — the device detail strip does. */
  kind?: MediaKind
  deviceId?: string
  /** A single calendar day, YYYY-MM-DD, matched against capturedAt. */
  date?: string
  /** Free text over the file name. Video Record only. */
  search?: string
}

/** Local-day bounds for a YYYY-MM-DD string, since capturedAt is epoch ms. */
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
  /** Site the helmet was at when it captured this. */
  site?: string
  kind: MediaKind
  status: MediaStatus
  /** When the helmet recorded it. */
  capturedAt: number
  /** When the bytes reached storage — diverges from capturedAt after an offline spell. */
  uploadedAt?: number
  durationMs?: number
  sizeBytes?: number
  /** What the file is called in storage. Shown and searched in Video Record. */
  fileName?: string
  /**
   * A link that plays or displays the full file directly, with no signing
   * step. Live recordings and photos come with one (a public Cloudflare R2
   * URL); when absent, the viewer asks for a signed URL instead.
   */
  url?: string
  thumbnailUrl?: string
  triggeredBy?: MediaTrigger
  alarmId?: string
  /** Where the helmet was when it captured this. */
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
