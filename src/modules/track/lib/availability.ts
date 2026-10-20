import type { TelemetrySample } from '@/modules/devices/types'

export interface DayAvailability {
  /** Local midnight for the day. */
  dayStart: number
  availableMs: number
  sampleCount: number
}

export interface AvailabilitySummary {
  days: DayAvailability[]
  totalAvailableMs: number
  /** Length of the requested period, for the proportion. */
  rangeMs: number
  /** Typical spacing between reports, derived from the data. */
  medianIntervalMs: number
  /** Legs longer than this are treated as the helmet being offline. */
  toleranceMs: number
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Calendar-aware rather than +24h, so a DST boundary can't shift a day. */
function nextDayStart(dayStart: number): number {
  const d = new Date(dayStart)
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * How long a helmet was actually reporting, per day.
 *
 * Counted from the gaps between consecutive reports rather than from a simple
 * sample count, because the reporting interval is configurable per device
 * (BEATTIM) — multiplying samples by an assumed interval would be wrong for
 * any helmet not on the default.
 *
 * Every heartbeat counts, with or without a GPS fix: a helmet indoors has no
 * position but is still online, and treating it as offline would make an
 * availability report useless for exactly the sites that need it.
 */
export function buildAvailability(
  samples: TelemetrySample[],
  from: number,
  to: number
): AvailabilitySummary {
  const inRange = samples
    .filter((s) => s.ts >= from && s.ts <= to)
    .sort((a, b) => a.ts - b.ts)

  // Every day in the range gets a bucket, including empty ones — a missing
  // bar and a zero bar mean the same thing and the chart should show both.
  const buckets = new Map<number, DayAvailability>()
  for (let day = startOfDay(from); day <= to; day = nextDayStart(day)) {
    buckets.set(day, { dayStart: day, availableMs: 0, sampleCount: 0 })
  }

  const intervals: number[] = []
  for (let i = 1; i < inRange.length; i += 1) {
    intervals.push(inRange[i].ts - inRange[i - 1].ts)
  }

  const medianIntervalMs = median(intervals)
  // Three missed reports, but never less than the two minutes the backend
  // itself uses to decide a device is offline.
  const toleranceMs = Math.max(120_000, medianIntervalMs * 3)

  const add = (ts: number, ms: number) => {
    const bucket = buckets.get(startOfDay(ts))
    if (bucket) bucket.availableMs += ms
  }

  for (const sample of inRange) {
    const bucket = buckets.get(startOfDay(sample.ts))
    if (bucket) bucket.sampleCount += 1
  }

  for (let i = 1; i < inRange.length; i += 1) {
    const start = inRange[i - 1].ts
    const end = inRange[i].ts
    if (end - start > toleranceMs) continue

    // A leg spanning midnight is split, so neither day is credited with
    // uptime that belongs to the other.
    let cursor = start
    while (cursor < end) {
      const boundary = nextDayStart(startOfDay(cursor))
      const chunkEnd = Math.min(end, boundary)
      add(cursor, chunkEnd - cursor)
      cursor = chunkEnd
    }
  }

  const days = [...buckets.values()].sort((a, b) => a.dayStart - b.dayStart)

  return {
    days,
    totalAvailableMs: days.reduce((sum, d) => sum + d.availableMs, 0),
    rangeMs: Math.max(0, to - from),
    medianIntervalMs,
    toleranceMs,
  }
}

/** "3h 51m" — matches how the reference platform words its total. */
export function formatUptime(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}
