const pad = (n: number) => String(n).padStart(2, '0')

/**
 * A date as "YYYY-MM-DD" in the tablet's own time zone. (Not toISOString, which is UTC: in Lagos
 * that names the previous day for the first hour after midnight.)
 */
export function localDay(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d'

export const PRESETS: Array<{ key: RangePreset; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
]

export function presetDates(preset: RangePreset, now: number = Date.now()): { fromDate: string; toDate: string } {
  const day = 86_400_000
  switch (preset) {
    case 'today':
      return { fromDate: localDay(now), toDate: localDay(now) }
    case 'yesterday':
      return { fromDate: localDay(now - day), toDate: localDay(now - day) }
    case '7d':
      return { fromDate: localDay(now - 6 * day), toDate: localDay(now) }
    case '30d':
      return { fromDate: localDay(now - 29 * day), toDate: localDay(now) }
  }
}

/** "2026-10-19" -> local midnight, or null if it isn't a real calendar date (2026-02-30 is not). */
export function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!m) return null
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null
}

/** The start of the first day to the last millisecond of the last, or null with a reason. */
export function rangeFromDates(fromDate: string, toDate: string): { from: number; to: number } | { error: string } {
  const from = parseDay(fromDate)
  const to = parseDay(toDate)
  if (!from || !to) return { error: 'Enter dates as YYYY-MM-DD, for example 2026-10-19.' }
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)
  if (from.getTime() > end.getTime()) return { error: 'The start date is after the end date.' }
  return { from: from.getTime(), to: end.getTime() }
}
