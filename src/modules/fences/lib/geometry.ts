import type { FenceDraft, LatLng, ValidPeriod } from '../types'
import { MIN_FENCE_ACROSS_M } from '../types'

const EARTH_M = 6_371_000
const rad = (d: number) => (d * Math.PI) / 180

/** Metres between two points (haversine; plenty for fences of a few km). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.sqrt(h))
}

/**
 * Smallest width of the shape, in metres: a circle's diameter, or the
 * narrower side of a polygon's bounding box. What the 50 m guidance is about.
 */
export function narrowestAcrossM(draft: Pick<FenceDraft, 'type' | 'radiusMeters' | 'points'>): number | null {
  if (draft.type === 'ROUND') return draft.radiusMeters > 0 ? draft.radiusMeters * 2 : null
  if (draft.points.length < 3) return null
  const lats = draft.points.map((p) => p.lat)
  const lngs = draft.points.map((p) => p.lng)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const height = distanceM({ lat: Math.min(...lats), lng: 0 }, { lat: Math.max(...lats), lng: 0 })
  const width = distanceM(
    { lat: midLat, lng: Math.min(...lngs) },
    { lat: midLat, lng: Math.max(...lngs) }
  )
  return Math.min(height, width)
}

export function isTooSmall(draft: Pick<FenceDraft, 'type' | 'radiusMeters' | 'points'>): boolean {
  const across = narrowestAcrossM(draft)
  return across !== null && across < MIN_FENCE_ACROSS_M
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Problems that stop a save, in the order a person would fix them. */
export function validateDraft(draft: FenceDraft): string[] {
  const problems: string[] = []
  if (!draft.name.trim()) problems.push('Give the fence a name.')
  if (draft.type === 'ROUND') {
    if (!draft.center) problems.push('Click the map to place the circle.')
    if (!(draft.radiusMeters > 0)) problems.push('The radius must be more than 0 m.')
  } else if (draft.points.length < 3) {
    problems.push(`Click at least 3 points on the map (${draft.points.length} so far).`)
  }
  draft.validPeriods.forEach((p: ValidPeriod, i) => {
    if (!TIME.test(p.start) || !TIME.test(p.end)) problems.push(`Hours ${i + 1}: enter both times.`)
    else if (p.start === p.end) problems.push(`Hours ${i + 1}: start and end can’t be the same.`)
  })
  return problems
}

/** "22:00 to 06:00 (overnight)" for a period that wraps past midnight. */
export function describePeriod(p: ValidPeriod): string {
  return `${p.start} to ${p.end}${p.end < p.start ? ' (overnight)' : ''}`
}
