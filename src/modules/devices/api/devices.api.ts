import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import {
  flag,
  num,
  parseGasData,
  shortDeviceName,
  ts,
} from '@/shared/lib/api-normalize'
import { getMockDevice, getMockFleet, getMockSummary } from './devices.mock'
import type { Device, FixType, FleetSummary, SimStatus } from '../types'

/** Exactly what GET /api/devices returns — every value a string. */
interface ApiDevice {
  deviceId: string
  /** Display name, e.g. "Test Helmet". Empty until someone names it. */
  name?: string | null
  lastBatteryLevel?: string | null
  lastLatitude?: string | null
  lastLongitude?: string | null
  lastWearStatus?: string | null
  lastNetStrength?: string | null
  firstSeenAt?: string | null
  lastSeenAt?: string | null
  accountId?: string | null
  active?: boolean
  online?: boolean
  /** Same "GAS--value;GAS--value" format as telemetry. Null until a sensor reports. */
  lastRawGasData?: string | null
  lastGasAt?: string | null
  // Location accuracy and SIM, live since 16 Oct. All null for a helmet that
  // is offline until its next report.
  lastFixType?: string | null
  lastGpsLevel?: string | null
  lastAccuracyMeters?: number | string | null
  simStatus?: number | null
  simPhoneNumber?: string | null
  simDataUsedMb?: number | string | null
  /** "wifi" or "4g". */
  networkType?: string | null
}

function toFixType(value: unknown): FixType | undefined {
  if (typeof value !== 'string' || !value) return undefined
  return value === 'gps' || value === 'network' || value === 'wifi' ? value : 'other'
}

function toSimStatus(value: unknown): SimStatus | undefined {
  return value === 0 || value === 1 || value === 2 ? value : undefined
}

function toDevice(api: ApiDevice): Device {
  return {
    // The deviceId stays the key for every API call; the name is display
    // only. A helmet without one shows its shortened ID instead.
    id: api.deviceId,
    name: api.name?.trim() || shortDeviceName(api.deviceId),
    named: Boolean(api.name?.trim()),
    // site, assignedTo and activeAlarm have no source in the API yet.
    active: api.active ?? true,
    // networkType says which link the helmet is on right now.
    connectivity: api.networkType === 'wifi' ? 'wifi' : 'sim',
    // Presence is derived from this timestamp rather than from the API's
    // `online` flag, so every screen agrees. See lib/presence.ts.
    lastSeenAt: ts(api.lastSeenAt) ?? 0,
    activeAlarm: null,
    telemetry: {
      batteryPercent: num(api.lastBatteryLevel),
      lat: num(api.lastLatitude),
      lng: num(api.lastLongitude),
      isWorn: flag(api.lastWearStatus),
      signalStrength: num(api.lastNetStrength),
      // Empty until a helmet with a gas sensor reports, so the gas slot
      // shows "no reading" rather than a false all-clear of zeros.
      gas: parseGasData(api.lastRawGasData),
      gasAt: ts(api.lastGasAt),
      fixType: toFixType(api.lastFixType),
      gpsLevel: num(api.lastGpsLevel),
      accuracyMeters: num(api.lastAccuracyMeters),
      simStatus: toSimStatus(api.simStatus),
      simPhoneNumber: api.simPhoneNumber?.trim() || undefined,
      simDataUsedMb: num(api.simDataUsedMb),
      networkType: api.networkType ?? undefined,
    },
  }
}

export { toDevice }

export async function fetchDevices(): Promise<Device[]> {
  if (env.useMocks) return getMockFleet()
  const { data } = await apiClient.get<ApiDevice[]>('/devices')
  return (data ?? []).map(toDevice)
}

export async function fetchDevice(id: string): Promise<Device | undefined> {
  if (env.useMocks) return getMockDevice(id)
  const { data } = await apiClient.get<ApiDevice>(`/devices/${id}`)
  return data ? toDevice(data) : undefined
}

interface ApiSummary {
  totalHelmets?: number
  onlineHelmets?: number
  offlineHelmets?: number
  activeHelmets?: number
  inactiveHelmets?: number
  recentAlarmsCount24h?: number
}

export async function fetchFleetSummary(): Promise<FleetSummary> {
  if (env.useMocks) return getMockSummary()

  const { data } = await apiClient.get<ApiSummary>('/dashboard/summary')
  return {
    total: data.totalHelmets ?? 0,
    online: data.onlineHelmets ?? 0,
    offline: data.offlineHelmets ?? 0,
    active: data.activeHelmets ?? 0,
    inactive: data.inactiveHelmets ?? 0,
    alarms24h: data.recentAlarmsCount24h ?? 0,
  }
}
