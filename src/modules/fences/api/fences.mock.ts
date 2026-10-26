import { CLIP_MAX_BYTES, validateClip, type ClipFile } from '../lib/clip'
import type { Fence, FenceDraft } from '../types'

let nextId = 3
const fences: Fence[] = [
  {
    id: 1,
    name: 'Island work area',
    type: 'ROUND',
    center: { lat: 6.453, lng: 3.398 },
    radiusMeters: 900,
    points: [],
    behavior: 'FORBIDDEN_TO_LEAVE',
    frequencyMinutes: 5,
    validPeriods: [{ start: '08:00', end: '17:00' }],
    deviceIds: [],
    active: true,
    hasWarningAudio: true,
  },
  {
    id: 2,
    name: 'Transformer yard',
    type: 'POLYGON',
    center: null,
    radiusMeters: 0,
    points: [
      { lat: 6.4634, lng: 3.4088 },
      { lat: 6.4636, lng: 3.4126 },
      { lat: 6.4606, lng: 3.4128 },
      { lat: 6.4604, lng: 3.4090 },
    ],
    behavior: 'NO_ENTRY',
    frequencyMinutes: 0,
    validPeriods: [],
    deviceIds: [],
    active: true,
    hasWarningAudio: false,
  },
]

const delay = () => new Promise((resolve) => setTimeout(resolve, 250))
const copy = (f: Fence): Fence => ({ ...f, points: f.points.map((p) => ({ ...p })), validPeriods: f.validPeriods.map((p) => ({ ...p })), deviceIds: [...f.deviceIds] })

export async function getMockFences(): Promise<Fence[]> {
  await delay()
  return fences.map(copy)
}

export async function saveMockFence(draft: FenceDraft, id?: number): Promise<Fence> {
  await delay()
  const error = (message: string) =>
    Object.assign(new Error(message), { response: { status: 400, data: { error: message } } })
  if (!draft.name.trim()) throw error('A fence needs a name.')
  if (draft.type === 'ROUND' && (!draft.center || !(draft.radiusMeters > 0))) throw error('A circle needs a centre and a radius.')
  if (draft.type === 'POLYGON' && draft.points.length < 3) throw error('A polygon needs at least 3 points.')

  const saved: Fence = { ...copy({ ...draft, id: id ?? nextId++, hasWarningAudio: false } as Fence), hasWarningAudio: fences.find((f) => f.id === id)?.hasWarningAudio ?? false }
  const index = fences.findIndex((f) => f.id === saved.id)
  if (index >= 0) fences[index] = saved
  else fences.push(saved)
  return copy(saved)
}

export async function deleteMockFence(id: number): Promise<void> {
  await delay()
  const index = fences.findIndex((f) => f.id === id)
  if (index >= 0) fences.splice(index, 1)
}

type ClipOp = { op: 'upload' | 'remove'; id: number; name?: string; size?: number }
const clipLog: ClipOp[] = []
const clipRecord = (entry: ClipOp) => {
  clipLog.push(entry)
  ;(globalThis as { __e5ClipLog?: ClipOp[] }).__e5ClipLog = clipLog
}
const httpError = (status: number, error?: string) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: error ? { error } : {} } })

export async function uploadMockClip(id: number, clip: ClipFile): Promise<void> {
  await delay()
  const fence = fences.find((f) => f.id === id)
  if (!fence) throw httpError(404)
  if ((globalThis as { __e5ClipFail?: boolean }).__e5ClipFail) throw httpError(500)
  const size = clip.file?.size ?? clip.size
  if (size != null && size > CLIP_MAX_BYTES) throw httpError(413)
  if (validateClip({ name: clip.name, mimeType: clip.mimeType, size })) throw httpError(400, 'The warning clip must be an MP3 or WAV file.')
  fence.hasWarningAudio = true
  clipRecord({ op: 'upload', id, name: clip.name, size })
}

export async function removeMockClip(id: number): Promise<void> {
  await delay()
  const fence = fences.find((f) => f.id === id)
  if (fence) fence.hasWarningAudio = false
  clipRecord({ op: 'remove', id })
}
