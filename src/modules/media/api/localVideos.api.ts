import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { ts } from '@/shared/lib/api-normalize'

/*
 * Videos still on the helmet's memory card. From the backend's guide of 14 Oct 2026 and the web dashboard.
 *
 * POST /api/devices/{id}/local-videos/refresh?days=7   -> { delivered }
 * GET  /api/devices/{id}/local-videos                  -> { reportedAt, files[] }
 * POST /api/devices/{id}/local-videos/upload           <- { files: [...] } | { all: true }
 *
 * Refresh needs the helmet online. Upload is queued for an offline helmet. Not yet tested on a real helmet.
 */

export interface HelmetVideo {
  fileName: string
  /** Helmet clock, no timezone. */
  recordedAt: number | null
  uploaded: boolean
  /** Set while an upload has been asked for and hasn't arrived yet. */
  uploadRequestedAt: number | null
}

export interface HelmetVideoReport {
  reportedAt: number | null
  files: HelmetVideo[]
}

interface ApiReport {
  reportedAt?: string | null
  files?: { fileName?: string; recordedAt?: string | null; uploaded?: boolean; uploadRequestedAt?: string | null }[]
}

export function toReport(data: ApiReport | null | undefined): HelmetVideoReport {
  return {
    reportedAt: ts(data?.reportedAt) ?? null,
    files: (data?.files ?? [])
      .filter((f) => f.fileName)
      .map((f) => ({ fileName: String(f.fileName), recordedAt: ts(f.recordedAt) ?? null, uploaded: f.uploaded === true, uploadRequestedAt: ts(f.uploadRequestedAt) ?? null })),
  }
}

// --- Sample data ---------------------------------------------------------
const mockReports = new Map<string, HelmetVideoReport>()

function mockFiles(days: number): HelmetVideo[] {
  const files: HelmetVideo[] = []
  const now = Date.now()
  const p = (n: number) => String(n).padStart(2, '0')
  for (let i = 0; i < Math.min(days * 2, 9); i += 1) {
    const at = new Date(now - i * 9 * 3_600_000)
    files.push({ fileName: `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}.mp4`, recordedAt: at.getTime(), uploaded: i % 3 === 2, uploadRequestedAt: null })
  }
  return files
}

/** The day range the helmet looks back over: 1 to 90. */
export function clampDays(days: number): number {
  return Math.max(1, Math.min(90, Math.round(days)))
}

export async function refreshHelmetVideos(deviceId: string, days: number): Promise<{ delivered: boolean }> {
  if (env.useMocks) {
    // An offline helmet doesn't answer, like the real one.
    const { getMockFleet } = await import('@/modules/devices/api/devices.mock')
    const { derivePresence } = await import('@/modules/devices/lib/presence')
    const d = getMockFleet().find((x) => x.id === deviceId)
    if (!d || d.lastSeenAt == null || derivePresence(d.lastSeenAt, Date.now()) === 'offline') return { delivered: false }
    setTimeout(() => mockReports.set(deviceId, { reportedAt: Date.now(), files: mockFiles(days) }), 1200)
    return { delivered: true }
  }
  const { data } = await apiClient.post<{ delivered?: boolean }>(`/devices/${deviceId}/local-videos/refresh`, null, { params: { days: clampDays(days) } })
  return { delivered: data?.delivered === true }
}

export async function fetchHelmetVideos(deviceId: string): Promise<HelmetVideoReport> {
  if (env.useMocks) {
    const r = mockReports.get(deviceId)
    return r ? { ...r, files: r.files.map((f) => ({ ...f })) } : { reportedAt: null, files: [] }
  }
  const { data } = await apiClient.get<ApiReport>(`/devices/${deviceId}/local-videos`)
  return toReport(data)
}

/** Asks the helmet to upload some clips, or everything not yet uploaded. */
export async function requestHelmetUpload(deviceId: string, target: { files: string[] } | { all: true }): Promise<{ delivered: boolean }> {
  if (env.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    const r = mockReports.get(deviceId)
    if (r) {
      for (const f of r.files) {
        const wanted = 'all' in target ? !f.uploaded : target.files.includes(f.fileName)
        if (wanted && !f.uploaded) {
          f.uploadRequestedAt = Date.now()
          setTimeout(() => {
            f.uploaded = true
            f.uploadRequestedAt = null
          }, 4000) // "arrives" a little later
        }
      }
    }
    return { delivered: true }
  }
  const { data } = await apiClient.post<{ delivered?: boolean }>(`/devices/${deviceId}/local-videos/upload`, target)
  // Queued when offline, so anything but an explicit false counts as accepted.
  return { delivered: data?.delivered !== false }
}

/**
 * Asks for a fresh report, then waits for one newer than the last. Polls every 2 s, as the guide suggests, and gives up
 * after 30 s. (The timings can be shortened, for tests.)
 */
export async function refreshAndWait(
  deviceId: string,
  days: number,
  signal: AbortSignal,
  { intervalMs = 2_000, giveUpMs = 30_000 }: { intervalMs?: number; giveUpMs?: number } = {}
): Promise<{ delivered: boolean; report: HelmetVideoReport | null }> {
  const before = (await fetchHelmetVideos(deviceId).catch(() => null))?.reportedAt ?? null
  const { delivered } = await refreshHelmetVideos(deviceId, days)
  if (!delivered) return { delivered, report: null }
  const giveUpAt = Date.now() + giveUpMs
  while (!signal.aborted && Date.now() < giveUpAt) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    if (signal.aborted) break
    const report = await fetchHelmetVideos(deviceId).catch(() => null)
    if (report?.reportedAt && report.reportedAt !== before) return { delivered, report }
  }
  return { delivered, report: null }
}
