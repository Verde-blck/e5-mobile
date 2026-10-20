import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { flag, millivoltsToVolts, num, pageContent, parseGasData, ts } from '@/shared/lib/api-normalize'
import type { Page } from '@/shared/lib/api-normalize'
import { toFixType } from '@/modules/devices/api/devices.api'
import type { TelemetrySample } from '@/modules/devices/types'
import { getMockTrackSamples } from './track.mock'

interface ApiTelemetry {
  id: number
  deviceId: string
  batteryLevel?: string | null
  batteryVoltage?: string | null
  altitude?: string | null
  chargingStatus?: string | null
  latitude?: string | null
  longitude?: string | null
  wearStatus?: string | null
  netStrength?: string | null
  rawGasData?: string | null
  recordedAt?: string | null
  /** From Cypher's 16 Oct update. null on older rows. */
  fixType?: string | null
  accuracyMeters?: number | string | null
}

/** How many rows one request will pull before the range is treated as cut short. */
const PAGE_SIZE = 2000

export interface TrackFetch {
  samples: TelemetrySample[]
  truncated: boolean
}

/**
 * Position history for one helmet over an arbitrary range.
 *
 * The telemetry endpoint has no date filtering: it returns raw rows newest first, so a large page is
 * pulled and the range applied afterwards. If the page fills, the oldest part of the requested range
 * may be missing, which the caller says out loud rather than quietly showing a short track.
 *
 * Still worth asking Cypher for: `from` and `to` parameters on GET /api/devices/{id}/telemetry.
 */
export async function fetchTrackSamples(deviceId: string, from: number, to: number): Promise<TrackFetch> {
  if (env.useMocks) return { samples: getMockTrackSamples(deviceId, from, to), truncated: false }

  const { data } = await apiClient.get<Page<ApiTelemetry>>(`/devices/${deviceId}/telemetry`, {
    params: { page: 0, size: PAGE_SIZE },
  })

  const rows = pageContent(data)
  const samples: TelemetrySample[] = rows.map((api) => ({
    ts: ts(api.recordedAt) ?? 0,
    batteryPercent: num(api.batteryLevel),
    batteryVoltage: millivoltsToVolts(api.batteryVoltage),
    altitude: num(api.altitude),
    lat: num(api.latitude),
    lng: num(api.longitude),
    signalStrength: num(api.netStrength),
    isCharging: flag(api.chargingStatus),
    isWorn: flag(api.wearStatus),
    gas: parseGasData(api.rawGasData),
    fixType: toFixType(api.fixType),
    accuracyMeters: num(api.accuracyMeters),
  }))

  const oldest = samples.reduce((min, s) => Math.min(min, s.ts || Infinity), Infinity)
  // The page filled and its oldest row is still newer than the range start, so older history wasn't received.
  const truncated = rows.length >= PAGE_SIZE && oldest > from

  return { samples, truncated }
}
