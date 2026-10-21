import { getMockFleet } from '@/modules/devices/api/devices.mock'
import { derivePresence } from '@/modules/devices/lib/presence'
import type { RecordedAudio } from '@/shared/hooks/useRecorder'
import { toneDataUri } from '../lib/tone'
import type { SendResult, VoiceMessage } from '../types'

// Sample conversations, like the web's mock: three messages per helmet (sent, from the wearer, sent).
const MINUTE = 60_000
const store = new Map<string, VoiceMessage[]>()
let nextId = 100
let tone: string | null = null
const audioUrl = () => (tone ??= toneDataUri())

function seed(deviceId: string): VoiceMessage[] {
  const now = Date.now()
  return [
    // test hook: a link that has expired, so the "recording no longer available" path can be seen
    { id: 1, deviceId, direction: 'TO_HELMET', audioUrl: (globalThis as { __e5ExpiredLink?: boolean }).__e5ExpiredLink ? 'https://expired.invalid/old.mp3' : audioUrl(), createdAt: now - 95 * MINUTE },
    { id: 2, deviceId, direction: 'FROM_HELMET', audioUrl: audioUrl(), createdAt: now - 88 * MINUTE },
    { id: 3, deviceId, direction: 'TO_HELMET', audioUrl: audioUrl(), createdAt: now - 22 * MINUTE },
  ]
}

export async function getMockMessages(deviceId: string): Promise<VoiceMessage[]> {
  await new Promise((resolve) => setTimeout(resolve, 150))
  if (!store.has(deviceId)) store.set(deviceId, seed(deviceId))
  return [...(store.get(deviceId) ?? [])].sort((a, b) => a.createdAt - b.createdAt)
}

type LogEntry = { deviceId: string; name: string; type: string; size: number; isFile: boolean; riff: string }
const log: LogEntry[] = []

/** An online helmet plays it now; an offline one has it queued. */
export async function sendMockMessage(deviceId: string, audio: RecordedAudio): Promise<SendResult> {
  await new Promise((resolve) => setTimeout(resolve, 500))
  // test hook: the server refusing the recording, or no answer at all (a network failure)
  const failure = (globalThis as { __e5SendError?: { network?: boolean; status?: number; data?: unknown } }).__e5SendError
  if (failure) throw Object.assign(new Error(failure.network ? 'Network Error' : `Request failed with status code ${failure.status}`), failure.network ? {} : { response: { status: failure.status, data: failure.data } })
  // What was actually attached, so a browser test can check it is a real WAV file and not "[object Object]".
  const head = audio.file ? new TextDecoder().decode(new Uint8Array(await audio.file.slice(0, 4).arrayBuffer())) : ''
  log.push({ deviceId, name: audio.name, type: audio.file?.type ?? audio.mimeType, size: audio.file?.size ?? audio.size ?? 0, isFile: !!audio.file, riff: head })
  ;(globalThis as { __e5MessageLog?: LogEntry[] }).__e5MessageLog = log // lets the browser tests see what was sent
  const message: VoiceMessage = { id: nextId++, deviceId, direction: 'TO_HELMET', audioUrl: audio.uri, createdAt: Date.now() }
  store.set(deviceId, [...(store.get(deviceId) ?? seed(deviceId)), message])
  const device = getMockFleet().find((d) => d.id === deviceId)
  return { messageId: message.id, audioUrl: message.audioUrl, delivered: !!device && derivePresence(device.lastSeenAt, Date.now()) !== 'offline' }
}
