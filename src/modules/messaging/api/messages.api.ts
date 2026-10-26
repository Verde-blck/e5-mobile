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

export async function fetchMessages(deviceId: string): Promise<VoiceMessage[]> {
  if (env.useMocks) return getMockMessages(deviceId)
  const { data } = await apiClient.get<Page<ApiMessage>>(`/devices/${deviceId}/messages`, { params: { page: 0, size: 50 } })
  return pageContent(data).map(toMessage).sort((a, b) => a.createdAt - b.createdAt)
}

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
