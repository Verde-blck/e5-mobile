import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { flag, millivoltsToVolts, num, pageContent, parseGasData, ts, wornFromWearCode } from '@/shared/lib/api-normalize'
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
  fixType?: string | null
  accuracyMeters?: number | string | null
}

const PAGE_SIZE = 10_000
// Each page is several megabytes of JSON on a tablet's data connection, so a very long range
// is trimmed (to its most recent part) and says so, rather than freezing the screen.
export const MAX_PAGES = 3

export interface TrackFetch {
  samples: TelemetrySample[]
  truncated: boolean
}

function toSample(api: ApiTelemetry): TelemetrySample {
  return {
    ts: ts(api.recordedAt) ?? 0,
    batteryPercent: num(api.batteryLevel),
    batteryVoltage: millivoltsToVolts(api.batteryVoltage),
    altitude: num(api.altitude),
    lat: num(api.latitude),
    lng: num(api.longitude),
    signalStrength: num(api.netStrength),
    isCharging: flag(api.chargingStatus),
    isWorn: wornFromWearCode(api.wearStatus),
    gas: parseGasData(api.rawGasData),
    fixType: toFixType(api.fixType),
    accuracyMeters: num(api.accuracyMeters),
  }
}

// Rows are requested newest first, so when the range is larger than MAX_PAGES
// pages it is the oldest part that is dropped, and `truncated` says so.
export async function fetchTrackSamples(deviceId: string, from: number, to: number): Promise<TrackFetch> {
  if (env.useMocks) return { samples: getMockTrackSamples(deviceId, from, to), truncated: false }

  const rows: ApiTelemetry[] = []
  let truncated = false

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data } = await apiClient.get<Page<ApiTelemetry>>(`/devices/${deviceId}/telemetry`, {
      // Z times: a +01:00 offset would have to be URL-encoded.
      params: { from: new Date(from).toISOString(), to: new Date(to).toISOString(), sort: 'desc', page, size: PAGE_SIZE },
    })
    const content = pageContent(data)
    rows.push(...content)

    const total = Array.isArray(data) ? undefined : data?.totalPages
    const more = typeof total === 'number' ? page + 1 < total : content.length >= PAGE_SIZE
    if (!more) break
    if (page + 1 === MAX_PAGES) truncated = true
  }

  return { samples: rows.map(toSample), truncated }
}
