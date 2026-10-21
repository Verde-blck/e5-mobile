import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { pageContent, ts } from '@/shared/lib/api-normalize'
import type { Page } from '@/shared/lib/api-normalize'
import type { RecordedAudio } from '@/shared/hooks/useRecorder'
import { clipMimeType } from '@/modules/fences/lib/clip'
import type { MessageDirection, SendResult, VoiceMessage } from '../types'
import { getMockMessages, sendMockMessage } from './messages.mock'

interface ApiMessage {
  id: number
  deviceId: string
  direction?: MessageDirection | null
  audioUrl?: string | null
  createdAt?: string | null
}

export function toMessage(api: ApiMessage): VoiceMessage {
  return { id: api.id, deviceId: api.deviceId, direction: api.direction ?? 'TO_HELMET', audioUrl: api.audioUrl ?? '', createdAt: ts(api.createdAt) ?? 0 }
}

/** A helmet's conversation, oldest first (the API sends newest first). Reading it needs no switch: it is a plain GET. */
export async function fetchMessages(deviceId: string): Promise<VoiceMessage[]> {
  if (env.useMocks) return getMockMessages(deviceId)
  const { data } = await apiClient.get<Page<ApiMessage>>(`/devices/${deviceId}/messages`, { params: { page: 0, size: 50 } })
  return pageContent(data).map(toMessage).sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * One recording to one helmet: POST /api/devices/{id}/messages/audio, multipart, a single `file` (the web's request, exactly).
 * It answers { messageId, audioUrl, delivered }; delivered: false means offline and queued.
 *
 * The backend converts what a tablet records (.m4a, .aac, .3gp) to MP3 for the helmet, as it does for fence clips (backend update
 * of 21 Oct 2026); a recording it can't convert is a 400 with its own reason, which is shown as it is.
 */
export async function sendVoiceMessage(deviceId: string, audio: RecordedAudio): Promise<SendResult> {
  if (env.useMocks) return sendMockMessage(deviceId, audio)
  const form = new FormData()
  if (audio.file) form.append('file', audio.file, audio.name)
  else form.append('file', { uri: audio.uri, name: audio.name, type: clipMimeType(audio.name, audio.mimeType) } as unknown as Blob)
  const { data } = await apiClient.post<SendResult>(`/devices/${deviceId}/messages/audio`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (body) => body,
  })
  return data
}
