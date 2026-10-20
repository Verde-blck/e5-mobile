import type { FenceBehavior, FenceShape, LatLng } from '@/modules/fences/types'
import type { Presence } from '@/modules/devices/types'

/** A helmet as the map needs it: a valid position, plus what to draw around it. */
export interface MapHelmet {
  id: string
  name: string
  lat: number
  lng: number
  presence: Presence
  /** The helmet's own accuracy radius, in metres. */
  accuracy?: number
  /** True when the position came from the mobile network or Wi-Fi, not GPS. */
  approximate: boolean
  /** The worst unresolved alarm on this helmet, if any. */
  alarm: 'critical' | 'warning' | null
}

/** An unresolved alarm with a position, drawn as its own pin. */
export interface MapAlarm {
  id: string
  lat: number
  lng: number
  severity: 'critical' | 'warning'
  label: string
  deviceName: string
}

/** A saved fence, drawn under the helmets. */
export interface MapFence {
  id: number
  type: FenceShape
  behavior: FenceBehavior
  active: boolean
  center: LatLng | null
  radiusMeters: number
  points: LatLng[]
}

/** The fence being drawn: draggable, and the map's taps place its centre or corners. */
export interface MapDraft {
  type: FenceShape
  behavior: FenceBehavior
  active: boolean
  center: LatLng | null
  radiusMeters: number
  points: LatLng[]
}

/** A route as drawn: one list of [lat, lng] per continuous run, so no line crosses a gap. */
export interface MapTrack {
  segments: Array<Array<[number, number]>>
  start: [number, number] | null
  end: [number, number] | null
}

export type MapFitTarget = 'all' | 'draft' | 'fences' | 'track'

/**
 * Everything is optional: a screen passes the layers it needs. The Live Map passes helmets,
 * alarms and fences; the fence editor a draft; the track screen a route and a cursor.
 */
export interface MapSurfaceProps {
  helmets?: MapHelmet[]
  alarms?: MapAlarm[]
  selectedId?: string | null
  fences?: MapFence[]
  selectedFenceId?: number | null
  /** Fade the saved fences and stop them taking taps (while another is being drawn). */
  dimFences?: boolean
  draft?: MapDraft | null
  track?: MapTrack | null
  /** Where the playback marker is. */
  cursor?: [number, number] | null
  /** Pixels at the bottom hidden by something laid over the map (the playback bar), kept clear when fitting a route. */
  fitInsetBottom?: number
  /** Bump this number to re-fit the view to `fitTarget`. */
  fitKey?: number
  fitTarget?: MapFitTarget
  onSelectHelmet?: (id: string | null) => void
  onSelectAlarm?: (id: string) => void
  onSelectFence?: (id: number) => void
  onMapTap?: (lat: number, lng: number) => void
  /** The draft changed by dragging its handle or a corner. */
  onDraftChange?: (patch: { center?: LatLng; points?: LatLng[] }) => void
}
