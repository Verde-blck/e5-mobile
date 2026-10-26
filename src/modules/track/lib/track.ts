import type { TelemetrySample } from '@/modules/devices/types'
import type { Track, TrackPoint, TrackStats } from '../types'

const EARTH_RADIUS_M = 6_371_000

export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

// GPS noise makes a stationary helmet report slightly different coordinates each time. Without a
// floor, a worker standing still for an hour accumulates a few hundred metres of imaginary walking.
const NOISE_FLOOR_M = 3

const GAP_MS = 5 * 60_000

// Faster than this and the fix is wrong, not fast: 40 m/s is 144 km/h, generous
// enough for a vehicle on a motorway and far below anything a bad fix produces.
const MAX_PLAUSIBLE_SPEED_MPS = 40

// Indoors a helmet reports 'network' (mobile mast) or 'wifi' fixes, which can be
// hundreds of metres off. Older rows have no fix type and are treated as GPS.
export function isApproximate(sample: Pick<TelemetrySample, 'fixType'>): boolean {
  return sample.fixType !== undefined && sample.fixType !== 'gps'
}

export function buildTrack(
  deviceId: string,
  samples: TelemetrySample[],
  from: number,
  to: number,
  truncated: boolean,
  options: { includeApproximate?: boolean } = {}
): Track {
  const located = samples
    .filter((s) => s.lat != null && s.lng != null && s.ts >= from && s.ts <= to)
    .sort((a, b) => a.ts - b.ts)
  // Mixing a 300 m-off network fix into a GPS walk adds distance the helmet never travelled.
  const fixes = options.includeApproximate ? located : located.filter((s) => !isApproximate(s))
  const approximateExcluded = located.length - fixes.length

  const points: TrackPoint[] = []
  let distanceMetres = 0
  let movingMs = 0
  let maxSpeedMps = 0
  let longestGapMs = 0
  let segment = 0
  let impossibleJumps = 0

  for (const fix of fixes) {
    const previous = points[points.length - 1]
    let stepMetres = 0
    let speedMps = 0

    if (previous) {
      const legMs = fix.ts - previous.ts
      const raw = haversine(previous, { lat: fix.lat as number, lng: fix.lng as number })
      // A leg with no elapsed time can't have a speed; treat it as a
      // jump rather than dividing by zero and producing infinity.
      const impliedSpeed = legMs > 0 ? raw / (legMs / 1000) : Infinity

      if (legMs > GAP_MS) {
        // Distance isn't counted across a gap: we have no idea what route was
        // taken, and a straight line through a building would be a lie.
        longestGapMs = Math.max(longestGapMs, legMs)
        segment += 1
      } else if (impliedSpeed > MAX_PLAUSIBLE_SPEED_MPS) {
        impossibleJumps += 1
        segment += 1
      } else {
        stepMetres = raw < NOISE_FLOOR_M ? 0 : raw
        distanceMetres += stepMetres
        if (legMs > 0) {
          speedMps = stepMetres / (legMs / 1000)
          maxSpeedMps = Math.max(maxSpeedMps, speedMps)
          if (stepMetres > 0) movingMs += legMs
        }
      }
    }

    points.push({
      ts: fix.ts,
      lat: fix.lat as number,
      lng: fix.lng as number,
      altitude: fix.altitude,
      batteryPercent: fix.batteryPercent,
      stepMetres,
      speedMps,
      segment,
      approximate: isApproximate(fix),
    })
  }

  const stats: TrackStats = {
    points: points.length,
    distanceMetres,
    durationMs: points.length > 1 ? points[points.length - 1].ts - points[0].ts : 0,
    movingMs,
    maxSpeedMps,
    longestGapMs,
    segments: points.length > 0 ? segment + 1 : 0,
    impossibleJumps,
    approximateExcluded,
  }

  return { deviceId, from, to, points, stats, truncated }
}

export function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`
}

export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

export function trackToCsv(track: Track, deviceName: string): string {
  const header = [
    'device_id',
    'device_name',
    'timestamp_iso',
    'latitude',
    'longitude',
    'altitude_m',
    'battery_percent',
    'step_metres',
    'speed_mps',
    'segment',
    'position_source',
  ].join(',')

  const rows = track.points.map((p) =>
    [
      track.deviceId,
      // Quoted in case a device name ever contains a comma.
      `"${deviceName.replace(/"/g, '""')}"`,
      new Date(p.ts).toISOString(),
      p.lat.toFixed(6),
      p.lng.toFixed(6),
      p.altitude ?? '',
      p.batteryPercent ?? '',
      p.stepMetres.toFixed(1),
      p.speedMps.toFixed(2),
      p.segment,
      p.approximate ? 'approximate' : 'gps',
    ].join(',')
  )

  return [header, ...rows].join('\n')
}

export function segmentsOf(points: TrackPoint[]): TrackPoint[][] {
  const runs: TrackPoint[][] = []
  for (const point of points) {
    if (!runs[point.segment]) runs[point.segment] = []
    runs[point.segment].push(point)
  }
  return runs.filter((run) => run && run.length > 0)
}
