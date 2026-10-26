import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { num } from '@/shared/lib/api-normalize'
import type { Fence, FenceBehavior, FenceDraft, FenceFrequency, FenceShape, LatLng } from '../types'
import { clipMimeType, type ClipFile } from '../lib/clip'
import { deleteMockFence, getMockFences, removeMockClip, saveMockFence, uploadMockClip } from './fences.mock'

type ApiFence = Record<string, unknown>

function toLatLng(raw: unknown): LatLng | null {
  const o = raw as { lat?: unknown; lng?: unknown } | null
  const lat = num(o?.lat)
  const lng = num(o?.lng)
  return lat != null && lng != null ? { lat, lng } : null
}

export function toFence(api: ApiFence): Fence {
  const freq = Number(api.frequencyMinutes)
  return {
    id: Number(api.id),
    name: String(api.name ?? ''),
    type: (api.type === 'POLYGON' ? 'POLYGON' : 'ROUND') as FenceShape,
    center: toLatLng(api.center),
    radiusMeters: num(api.radiusMeters) ?? 0,
    points: Array.isArray(api.points) ? (api.points.map(toLatLng).filter(Boolean) as LatLng[]) : [],
    behavior: (api.behavior === 'NO_ENTRY' ? 'NO_ENTRY' : 'FORBIDDEN_TO_LEAVE') as FenceBehavior,
    frequencyMinutes: ([0, 5, 10, 15, 20].includes(freq) ? freq : 0) as FenceFrequency,
    validPeriods: Array.isArray(api.validPeriods)
      ? (api.validPeriods as { start?: string; end?: string }[]).map((p) => ({
          start: String(p.start ?? '').slice(0, 5),
          end: String(p.end ?? '').slice(0, 5),
        }))
      : [],
    deviceIds: Array.isArray(api.deviceIds) ? (api.deviceIds as unknown[]).map(String) : [],
    active: api.active !== false,
    hasWarningAudio: Boolean(api.hasWarningAudio ?? api.warningAudioUrl),
  }
}

export function toBody(draft: FenceDraft) {
  return {
    name: draft.name.trim(),
    type: draft.type,
    ...(draft.type === 'ROUND'
      ? { center: draft.center, radiusMeters: Math.round(draft.radiusMeters) }
      : { points: draft.points }),
    behavior: draft.behavior,
    frequencyMinutes: draft.frequencyMinutes,
    validPeriods: draft.validPeriods,
    deviceIds: draft.deviceIds,
    active: draft.active,
  }
}

export function fenceErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { error?: string } } })?.response
  if (response?.data?.error) return response.data.error
  if (response?.status === 403) return "Your role isn't allowed to change fences."
  if (response?.status === 413) return 'That clip is too large. The limit is 5 MB.'
  return "Couldn't save the fence. Check your connection and try again."
}

export async function fetchFences(): Promise<Fence[]> {
  if (env.useMocks) return getMockFences()
  const { data } = await apiClient.get<ApiFence[] | { content?: ApiFence[] }>('/fences')
  const rows = Array.isArray(data) ? data : (data?.content ?? [])
  return rows.map(toFence)
}

export async function saveFence(draft: FenceDraft, id?: number): Promise<Fence> {
  if (env.useMocks) return saveMockFence(draft, id)
  const { data } = id
    ? await apiClient.put<ApiFence>(`/fences/${id}`, toBody(draft))
    : await apiClient.post<ApiFence>('/fences', toBody(draft))
  return toFence(data)
}

export async function deleteFence(id: number): Promise<void> {
  if (env.useMocks) return deleteMockFence(id)
  await apiClient.delete(`/fences/${id}`)
}

export function toDraft(fence: Fence): FenceDraft {
  const { id: _id, hasWarningAudio: _audio, ...draft } = fence
  return draft
}

export function buildClipForm(clip: ClipFile): FormData {
  const form = new FormData()
  const type = clipMimeType(clip.name, clip.mimeType)
  if (clip.file) form.append('file', clip.file, clip.name)
  else form.append('file', { uri: clip.uri, name: clip.name, type } as unknown as Blob)
  return form
}

export async function uploadWarningAudio(id: number, clip: ClipFile): Promise<void> {
  if (env.useMocks) return uploadMockClip(id, clip)
  await apiClient.post(`/fences/${id}/warning-audio`, buildClipForm(clip), {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data,
  })
}

export async function removeWarningAudio(id: number): Promise<void> {
  if (env.useMocks) return removeMockClip(id)
  await apiClient.delete(`/fences/${id}/warning-audio`)
}

export function clipErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { error?: string } } })?.response
  if (response?.status === 413) return 'That clip is too large. The limit is 5 MB.'
  if (response?.data?.error) return response.data.error
  if (response?.status === 403) return "Your role isn't allowed to change fences."
  return "Couldn't upload the clip. Check your connection and try again."
}

export interface SaveResult {
  fence: Fence
  clipError: string | null
}

// The clip is a separate request that needs the fence's id first, so if it fails the fence is already saved. That
// is reported on its own, so the person neither loses the fence nor creates a second copy by saving again.
export async function saveFenceWithClip(draft: FenceDraft, id: number | undefined, clip: ClipFile | null | undefined): Promise<SaveResult> {
  const fence = await saveFence(draft, id)
  if (clip === undefined) return { fence, clipError: null }
  try {
    if (clip) await uploadWarningAudio(fence.id, clip)
    else await removeWarningAudio(fence.id)
    return { fence: { ...fence, hasWarningAudio: !!clip }, clipError: null }
  } catch (error) {
    return { fence, clipError: clipErrorMessage(error) }
  }
}
