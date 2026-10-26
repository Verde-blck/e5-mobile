import type { FenceBehavior, FenceShape, LatLng } from '@/modules/fences/types'
import type { Presence } from '@/modules/devices/types'

export interface MapHelmet {
  id: string
  name: string
  lat: number
  lng: number
  presence: Presence
  accuracy?: number
  approximate: boolean
  alarm: 'critical' | 'warning' | null
}

export interface MapAlarm {
  id: string
  lat: number
  lng: number
  severity: 'critical' | 'warning'
  label: string
  deviceName: string
}

export interface MapFence {
  id: number
  type: FenceShape
  behavior: FenceBehavior
  active: boolean
  center: LatLng | null
  radiusMeters: number
  points: LatLng[]
}

export interface MapDraft {
  type: FenceShape
  behavior: FenceBehavior
  active: boolean
  center: LatLng | null
  radiusMeters: number
  points: LatLng[]
}

export interface MapTrack {
  segments: Array<Array<[number, number]>>
  start: [number, number] | null
  end: [number, number] | null
}

export type MapFitTarget = 'all' | 'draft' | 'fences' | 'track'

export interface MapSurfaceProps {
  helmets?: MapHelmet[]
  alarms?: MapAlarm[]
  selectedId?: string | null
  fences?: MapFence[]
  selectedFenceId?: number | null
  dimFences?: boolean
  draft?: MapDraft | null
  track?: MapTrack | null
  cursor?: [number, number] | null
  fitInsetBottom?: number
  fitKey?: number
  fitTarget?: MapFitTarget
  onSelectHelmet?: (id: string | null) => void
  onSelectAlarm?: (id: string) => void
  onSelectFence?: (id: number) => void
  onMapTap?: (lat: number, lng: number) => void
  onDraftChange?: (patch: { center?: LatLng; points?: LatLng[] }) => void
}
