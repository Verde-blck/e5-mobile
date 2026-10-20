import { getMockDevice } from '@/modules/devices/api/devices.mock'
import type { TelemetrySample } from '@/modules/devices/types'

/** Seeded so a given helmet walks the same route every time it's replayed. */
function mulberry32(seed: number) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFor(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return Math.abs(hash) || 1
}

const STEP_MS = 60_000
const MAX_STEPS = 1500

/**
 * A plausible walk rather than scattered coordinates: heading carries over between steps and turns
 * gradually, with the occasional stand-still, so a replay reads as someone moving around a site.
 *
 * It also has the three things real histories have, so each can be seen working:
 *  - a 12-minute stretch with no reports (out of coverage),
 *  - one reading from the other side of the world (factory test data left in a device),
 *  - a handful of indoor positions from the mobile network, a few hundred metres out.
 *
 * Anchored to the END of the requested range and starting near where the sample helmet is now.
 */
export function getMockTrackSamples(deviceId: string, from: number, to: number): TelemetrySample[] {
  const end = Math.min(to, Date.now())
  const start = Math.max(from, end - MAX_STEPS * STEP_MS)
  if (end <= start) return []

  const rand = mulberry32(seedFor(deviceId))
  const home = getMockDevice(deviceId)?.telemetry
  let lat = (home?.lat ?? 6.4474) + (rand() - 0.5) * 0.004
  let lng = (home?.lng ?? 3.4012) + (rand() - 0.5) * 0.004
  let heading = rand() * Math.PI * 2
  let battery = 96

  const steps = Math.floor((end - start) / STEP_MS)
  const gapAt = Math.floor(steps * 0.4)
  const jumpAt = Math.floor(steps * 0.7)
  const samples: TelemetrySample[] = []

  for (let i = 0; i < steps; i += 1) {
    if (steps > 60 && i >= gapAt && i < gapAt + 12) continue // out of coverage

    const moving = rand() > 0.16
    if (moving) {
      heading += (rand() - 0.5) * 0.8
      const metres = 50 + rand() * 40 // about 1.2 m/s
      lat += (metres / 111_320) * Math.cos(heading)
      lng += (metres / (111_320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(heading)
    }
    if (i % 12 === 0) battery = Math.max(5, battery - 1)

    let fixLat = lat
    let fixLng = lng
    let fixType: TelemetrySample['fixType'] = 'gps'
    let accuracyMeters = 3 + rand() * 5

    if (steps > 60 && i === jumpAt) {
      fixLat = 27.6
      fixLng = 112.9 // Hunan province
    } else if (i % 37 === 5) {
      fixType = 'network'
      accuracyMeters = 250 + rand() * 150
      fixLat += (rand() - 0.5) * 0.005
      fixLng += (rand() - 0.5) * 0.005
    }

    samples.push({
      ts: start + i * STEP_MS,
      lat: Number(fixLat.toFixed(6)),
      lng: Number(fixLng.toFixed(6)),
      altitude: Number((38 + rand() * 14).toFixed(1)),
      batteryPercent: battery,
      signalStrength: 3 + Math.round(rand() * 2),
      isWorn: true,
      fixType,
      accuracyMeters: Number(accuracyMeters.toFixed(1)),
    })
  }
  return samples
}
