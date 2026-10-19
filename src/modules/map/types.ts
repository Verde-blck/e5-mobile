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

export interface MapSurfaceProps {
  helmets: MapHelmet[]
  alarms: MapAlarm[]
  selectedId: string | null
  /** Bump this number to re-fit the view to everything on the map. */
  fitKey: number
  /** null = the empty map was tapped. */
  onSelectHelmet: (id: string | null) => void
  onSelectAlarm: (id: string) => void
}
