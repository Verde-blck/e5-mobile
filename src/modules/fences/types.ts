/*
 * Geofences, from the backend's guide (13 Oct 2026, "Geofences").
 *
 * A work area alarms when a helmet leaves it; a no-entry zone alarms when a
 * helmet goes in. The backend checks every location report (about every
 * 10 s) and raises alarm code 2 or 5.
 */

export interface LatLng {
  lat: number
  lng: number
}

export type FenceShape = 'ROUND' | 'POLYGON'

/** FORBIDDEN_TO_LEAVE = work area · NO_ENTRY = restricted area */
export type FenceBehavior = 'FORBIDDEN_TO_LEAVE' | 'NO_ENTRY'

/** Minutes between repeat alarms while a helmet stays in breach. 0 = every report. */
export type FenceFrequency = 0 | 5 | 10 | 15 | 20

/** "HH:mm", Lagos time. A period can cross midnight (22:00 to 06:00). */
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
  /** Empty = always active. */
  validPeriods: ValidPeriod[]
  /** Empty = every helmet. */
  deviceIds: string[]
  active: boolean
}

export interface Fence extends FenceDraft {
  id: number
  /** Whether a warning clip is attached; the API's field name is a best guess. */
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

/** GPS jumps 10 to 50 m indoors or on a weak signal; smaller fences false-alarm. */
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
