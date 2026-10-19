/** What the map page tells the app. Everything crossing that boundary is validated here. */
export type MapEvent =
  | { type: 'ready' }
  | { type: 'select'; id: string }
  | { type: 'deselect' }
  | { type: 'selectAlarm'; id: string }

/** Turns whatever arrived from the page into a MapEvent, or null if it isn't one. */
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
  const { type, id } = value as { type?: unknown; id?: unknown }
  if (type === 'ready' || type === 'deselect') return { type }
  if ((type === 'select' || type === 'selectAlarm') && typeof id === 'string' && id) return { type, id }
  return null
}
