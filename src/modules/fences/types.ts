
export interface LatLng {
  lat: number
  lng: number
}

export type FenceShape = 'ROUND' | 'POLYGON'

export type FenceBehavior = 'FORBIDDEN_TO_LEAVE' | 'NO_ENTRY'

export type FenceFrequency = 0 | 5 | 10 | 15 | 20

export interface ValidPeriod {
  start: string
  end: string
}

export interface FenceDraft {
  name: string
  type: FenceShape
  center: LatLng | null
  radiusMeters: number
  points: LatLng[]
  behavior: FenceBehavior
  frequencyMinutes: FenceFrequency
  validPeriods: ValidPeriod[]
  deviceIds: string[]
  active: boolean
}

export interface Fence extends FenceDraft {
  id: number
  hasWarningAudio: boolean
}

export const FREQUENCIES: { value: FenceFrequency; label: string }[] = [
  { value: 0, label: 'Every location report' },
  { value: 5, label: 'Every 5 minutes' },
  { value: 10, label: 'Every 10 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 20, label: 'Every 20 minutes' },
]

export const BEHAVIOR_LABEL: Record<FenceBehavior, { short: string; long: string }> = {
  FORBIDDEN_TO_LEAVE: { short: 'Work area', long: 'Alarm when a helmet leaves' },
  NO_ENTRY: { short: 'No-entry zone', long: 'Alarm when a helmet enters' },
}

export const MIN_FENCE_ACROSS_M = 50

export const EMPTY_DRAFT: FenceDraft = {
  name: '',
  type: 'ROUND',
  center: null,
  radiusMeters: 100,
  points: [],
  behavior: 'FORBIDDEN_TO_LEAVE',
  frequencyMinutes: 5,
  validPeriods: [],
  deviceIds: [],
  active: true,
}
