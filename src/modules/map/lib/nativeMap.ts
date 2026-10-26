import type { LatLng } from '@/modules/fences/types'
import type { MapFence, MapFitTarget, MapHelmet, MapTrack, MapDraft, MapAlarm } from '../types'

export interface Coordinate {
  latitude: number
  longitude: number
}

export const toCoordinate = (p: LatLng | readonly [number, number]): Coordinate =>
  Array.isArray(p) ? { latitude: (p as readonly [number, number])[0], longitude: (p as readonly [number, number])[1] } : { latitude: (p as LatLng).lat, longitude: (p as LatLng).lng }

export const COLOURS = {
  online: '#059669',
  degraded: '#F59E0B',
  offline: '#94A3B8',
  critical: '#DC2626',
  warning: '#D97706',
  work: '#0A6659',
  noEntry: '#D97706',
  inactive: '#94A3B8',
  deep: '#0C352F',
  route: '#0F766E',
  start: '#10B981',
  end: '#EF4444',
  cursor: '#F59E0B',
  cursorRing: '#B45309',
} as const

export function withAlpha(hex: string, alpha: number): string {
  const v = hex.replace('#', '')
  return `rgba(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)}, ${alpha})`
}

export type MapEngine = 'google' | 'leaflet'

export function chooseMapEngine(options: { platform: string; hasKey: boolean; preference?: string }): MapEngine {
  if (options.platform !== 'android' || !options.hasKey) return 'leaflet'
  const preference = (options.preference ?? '').trim().toLowerCase()
  return preference === 'osm' || preference === 'leaflet' ? 'leaflet' : 'google'
}

export interface FenceStyle {
  stroke: string
  fill: string
  width: number
}

export function fenceStyle(fence: Pick<MapFence, 'active' | 'behavior'>, selected: boolean, dim: boolean): FenceStyle {
  if (!fence.active) return { stroke: withAlpha(COLOURS.inactive, 0.7), fill: withAlpha(COLOURS.inactive, 0.06), width: 1.5 }
  const colour = fence.behavior === 'NO_ENTRY' ? COLOURS.noEntry : COLOURS.work
  return {
    stroke: withAlpha(colour, dim ? 0.4 : 0.9),
    fill: withAlpha(colour, dim ? 0.05 : fence.behavior === 'NO_ENTRY' ? 0.18 : 0.1),
    width: selected ? 4 : 2,
  }
}

export interface DraftStyle {
  colour: string
  stroke: string
  fill: string
  width: number
}

export function draftStyle(draft: Pick<MapDraft, 'active' | 'behavior'>): DraftStyle {
  const colour = draft.behavior === 'NO_ENTRY' ? COLOURS.noEntry : COLOURS.work
  return draft.active
    ? { colour, stroke: withAlpha(colour, 1), fill: withAlpha(colour, 0.18), width: 3 }
    : { colour: COLOURS.inactive, stroke: withAlpha(COLOURS.inactive, 1), fill: withAlpha(COLOURS.inactive, 0.08), width: 3 }
}

export interface AccuracyStyle {
  radius: number
  stroke: string
  fill: string
  width: number
  dash?: number[]
}

export function accuracyStyle(helmet: Pick<MapHelmet, 'accuracy' | 'approximate'>, selected: boolean): AccuracyStyle | null {
  const radius = helmet.accuracy ?? 0
  if (!(radius > 0) || !(helmet.approximate || selected)) return null
  return helmet.approximate
    ? { radius, stroke: withAlpha(COLOURS.warning, 1), fill: withAlpha(COLOURS.degraded, 0.12), width: 1.5, dash: [5, 4] }
    : { radius, stroke: withAlpha(COLOURS.work, 1), fill: withAlpha(COLOURS.work, 0.1), width: 1.5 }
}

export const helmetLook = (helmet: Pick<MapHelmet, 'presence' | 'alarm'>, selected: boolean): string => `${helmet.presence}|${selected ? 1 : 0}|${helmet.alarm ?? ''}`

export const helmetZ = (helmet: Pick<MapHelmet, 'alarm'>, selected: boolean): number => (selected ? 1000 : helmet.alarm ? 500 : 0)
export const ALARM_PIN_Z = 800
export const CURSOR_Z = 1000

const METRES_PER_DEGREE = 111_320

export function circleBounds(center: LatLng, radiusMeters: number): Coordinate[] {
  const dLat = radiusMeters / METRES_PER_DEGREE
  const dLng = radiusMeters / (METRES_PER_DEGREE * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01))
  return [
    { latitude: center.lat + dLat, longitude: center.lng },
    { latitude: center.lat - dLat, longitude: center.lng },
    { latitude: center.lat, longitude: center.lng + dLng },
    { latitude: center.lat, longitude: center.lng - dLng },
  ]
}

// One helmet, or a few close together, would zoom in until the street is a
// blur, so two invisible points keep the frame at least `minMetres` across.
export function withMinSpan(points: Coordinate[], minMetres = 160): Coordinate[] {
  if (points.length === 0) return points
  const lats = points.map((p) => p.latitude)
  const lngs = points.map((p) => p.longitude)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
  const heightM = (Math.max(...lats) - Math.min(...lats)) * METRES_PER_DEGREE
  const widthM = (Math.max(...lngs) - Math.min(...lngs)) * METRES_PER_DEGREE * Math.cos((midLat * Math.PI) / 180)
  if (heightM >= minMetres && widthM >= minMetres) return points
  const halfLat = minMetres / 2 / METRES_PER_DEGREE
  const halfLng = minMetres / 2 / (METRES_PER_DEGREE * Math.max(Math.cos((midLat * Math.PI) / 180), 0.01))
  return [...points, { latitude: midLat + halfLat, longitude: midLng + halfLng }, { latitude: midLat - halfLat, longitude: midLng - halfLng }]
}

// Stray one or two point outliers are left out when framing a route: a fix from
// another continent would zoom out so far that the real route became a dot.
export function trackFitPoints(track: MapTrack | null | undefined): Coordinate[] {
  if (!track || track.segments.length === 0) return []
  let runs = track.segments.filter((segment) => segment.length >= 3)
  if (runs.length === 0) runs = [track.segments.reduce((best, segment) => (segment.length > best.length ? segment : best), track.segments[0])]
  return runs.flat().map(toCoordinate)
}

export interface FitInput {
  helmets?: readonly MapHelmet[]
  alarms?: readonly MapAlarm[]
  fences?: readonly MapFence[]
  draft?: MapDraft | null
  track?: MapTrack | null
}

const fenceBounds = (f: Pick<MapFence, 'type' | 'center' | 'radiusMeters' | 'points'>): Coordinate[] =>
  f.type === 'ROUND' ? (f.center ? circleBounds(f.center, f.radiusMeters) : []) : f.points.map(toCoordinate)

export function fitCoordinates(target: MapFitTarget, input: FitInput): Coordinate[] {
  switch (target) {
    case 'track':
      return trackFitPoints(input.track)
    case 'draft':
      return input.draft ? fenceBounds(input.draft) : []
    case 'fences':
      return (input.fences ?? []).flatMap(fenceBounds)
    default:
      return [...(input.helmets ?? []).map((h) => ({ latitude: h.lat, longitude: h.lng })), ...(input.alarms ?? []).map((a) => ({ latitude: a.lat, longitude: a.lng }))]
  }
}

export function edgePadding(target: MapFitTarget, bottomInset = 0): { top: number; right: number; bottom: number; left: number } {
  return target === 'track' ? { top: 48, right: 48, bottom: 48 + bottomInset, left: 48 } : { top: 60, right: 60, bottom: 60, left: 60 }
}

export interface Bounds {
  northEast: Coordinate
  southWest: Coordinate
}

export function nearEdgeOrOff(at: Coordinate, bounds: Bounds, margin = 0.2): boolean {
  const latSpan = bounds.northEast.latitude - bounds.southWest.latitude
  const lngSpan = bounds.northEast.longitude - bounds.southWest.longitude
  return (
    at.latitude > bounds.northEast.latitude - latSpan * margin ||
    at.latitude < bounds.southWest.latitude + latSpan * margin ||
    at.longitude > bounds.northEast.longitude - lngSpan * margin ||
    at.longitude < bounds.southWest.longitude + lngSpan * margin
  )
}

export function distanceMetres(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function inPolygon(at: LatLng, points: readonly LatLng[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]
    const b = points[j]
    if (a.lat > at.lat !== b.lat > at.lat && at.lng < ((b.lng - a.lng) * (at.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside
  }
  return inside
}

export function fenceAt(at: LatLng, fences: readonly MapFence[]): number | null {
  for (let i = fences.length - 1; i >= 0; i--) {
    const f = fences[i]
    const hit = f.type === 'ROUND' ? !!f.center && distanceMetres(at, f.center) <= f.radiusMeters : f.points.length >= 3 && inPolygon(at, f.points)
    if (hit) return f.id
  }
  return null
}
