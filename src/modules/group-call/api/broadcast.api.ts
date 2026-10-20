import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { clipMimeType } from '@/modules/fences/lib/clip'
import { getMockFleet } from '@/modules/devices/api/devices.mock'
import { derivePresence } from '@/modules/devices/lib/presence'
import type { RecordedAudio } from '@/shared/hooks/useRecorder'
import type { Delivery } from '../types'

/** Voice messages to several helmets aren't switched on in this build. */
export class BroadcastUnavailable extends Error {
  constructor() {
    super('Voice messages to a group are not switched on in this build yet.')
    this.name = 'BroadcastUnavailable'
  }
}

/** Whether the screen should offer voice messages at all (never a button that can only fail). */
export const broadcastAvailable = () => env.useMocks || env.broadcastEnabled

/**
 * The request, as the web sends it (its messaging/api/messages.api.ts): POST /api/broadcast, multipart, with
 * `file` (the recording) and `deviceIds` as ONE comma-joined string. The answer is { helmets: [{ deviceId,
 * delivered, messageId }] }, one entry per helmet the backend took. `delivered: false` means offline: the message
 * is queued and plays when the helmet reconnects.
 *
 * Still unconfirmed, and the reason this stays off until EXPO_PUBLIC_BROADCAST_ENABLED=true: the web sends MP3, and
 * an Android tablet can only record AAC in an .m4a file. The backend converts .m4a to MP3 for fence clips; it must
 * do the same here. See docs/GROUP_CALL.md.
 */
export function buildBroadcastForm(deviceIds: readonly string[], audio: RecordedAudio): FormData {
  const form = new FormData()
  if (audio.file) form.append('file', audio.file, audio.name)
  else form.append('file', { uri: audio.uri, name: audio.name, type: clipMimeType(audio.name, audio.mimeType) } as unknown as Blob)
  form.append('deviceIds', deviceIds.join(','))
  return form
}

export async function sendBroadcast(deviceIds: readonly string[], audio: RecordedAudio): Promise<Delivery[]> {
  // deviceIds is always sent explicitly, and never empty: leaving it out would send the message to EVERY active
  // helmet in the fleet, which is never what a selection means. (The web guards this the same way.)
  if (deviceIds.length === 0) return []
  if (env.useMocks) return mockBroadcast(deviceIds, audio)
  if (!env.broadcastEnabled) throw new BroadcastUnavailable()
  const { data } = await apiClient.post<{ helmets?: Delivery[] }>('/broadcast', buildBroadcastForm(deviceIds, audio), {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (body) => body,
  })
  return (data?.helmets ?? []).map((h) => ({ deviceId: h.deviceId, delivered: h.delivered === true, messageId: h.messageId }))
}

type LogEntry = { ids: string[]; name: string }
const log: LogEntry[] = []

/** Sample data: a reachable helmet plays it now, an offline one has it queued, and a deactivated one isn't taken. */
async function mockBroadcast(deviceIds: readonly string[], audio: RecordedAudio): Promise<Delivery[]> {
  await new Promise((resolve) => setTimeout(resolve, 700))
  log.push({ ids: [...deviceIds], name: audio.name })
  ;(globalThis as { __e5BroadcastLog?: LogEntry[] }).__e5BroadcastLog = log // lets the browser tests see what was sent
  const fleet = getMockFleet()
  const out: Delivery[] = []
  for (const id of deviceIds) {
    const device = fleet.find((d) => d.id === id)
    if (!device || !device.active) continue
    out.push({ deviceId: id, delivered: derivePresence(device.lastSeenAt, Date.now()) !== 'offline', messageId: out.length + 1 })
  }
  return out
}
