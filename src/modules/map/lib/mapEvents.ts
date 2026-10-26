import type { LatLng } from '@/modules/fences/types'

export type MapEvent =
  | { type: 'ready' }
  | { type: 'select'; id: string }
  | { type: 'deselect' }
  | { type: 'selectAlarm'; id: string }
  | { type: 'selectFence'; id: number }
  | { type: 'mapTap'; lat: number; lng: number }
  | { type: 'draftCenter'; lat: number; lng: number }
  | { type: 'draftPoints'; points: LatLng[] }

const validLat = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 90
const validLng = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 180

export function parseMapEvent(raw: unknown): MapEvent | null {
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof value !== 'object' || value === null) return null
  const { type, id, lat, lng, points } = value as Record<string, unknown>

  if (type === 'ready' || type === 'deselect') return { type }
  if ((type === 'select' || type === 'selectAlarm') && typeof id === 'string' && id) return { type, id }
  if (type === 'selectFence' && typeof id === 'number' && Number.isInteger(id)) return { type, id }
  if ((type === 'mapTap' || type === 'draftCenter') && validLat(lat) && validLng(lng)) return { type, lat, lng }
  if (type === 'draftPoints' && Array.isArray(points)) {
    const clean = points.map((p) => (p && validLat((p as LatLng).lat) && validLng((p as LatLng).lng) ? { lat: (p as LatLng).lat, lng: (p as LatLng).lng } : null))
    if (clean.every((p): p is LatLng => p !== null)) return { type, points: clean }
  }
  return null
}

export interface MapHandlers {
  onReady?: () => void
  onSelectHelmet?: (id: string | null) => void
  onSelectAlarm?: (id: string) => void
  onSelectFence?: (id: number) => void
  onMapTap?: (lat: number, lng: number) => void
  onDraftChange?: (patch: { center?: LatLng; points?: LatLng[] }) => void
}

export function dispatchMapEvent(event: MapEvent, handlers: MapHandlers): void {
  switch (event.type) {
    case 'ready': return handlers.onReady?.()
    case 'select': return handlers.onSelectHelmet?.(event.id)
    case 'deselect': return handlers.onSelectHelmet?.(null)
    case 'selectAlarm': return handlers.onSelectAlarm?.(event.id)
    case 'selectFence': return handlers.onSelectFence?.(event.id)
    case 'mapTap': return handlers.onMapTap?.(event.lat, event.lng)
    case 'draftCenter': return handlers.onDraftChange?.({ center: { lat: event.lat, lng: event.lng } })
    case 'draftPoints': return handlers.onDraftChange?.({ points: event.points })
  }
}
