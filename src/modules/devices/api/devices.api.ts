import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import {
  flag,
  num,
  parseGasData,
  parseGasStatus,
  type GasStatus,
  shortDeviceName,
  ts,
} from '@/shared/lib/api-normalize'
import { getMockDevice, getMockFleet, getMockSummary, getMockGasStatus } from './devices.mock'
import type { Device, FixType, FleetSummary, SimStatus } from '../types'

interface ApiDevice {
  deviceId: string
  name?: string | null
  lastBatteryLevel?: string | null
  lastLatitude?: string | null
  lastLongitude?: string | null
  // Whether it is on someone's head. null when the helmet is offline or
  // hasn't reported, so a disconnected helmet never shows "Yes".
  worn?: boolean | null
  wearState?: 'worn' | 'not_worn' | 'unknown' | null
  workerName?: string | null
  workerStaffId?: string | null
  workerPhone?: string | null
  lastNetStrength?: string | null
  firstSeenAt?: string | null
  lastSeenAt?: string | null
  accountId?: string | null
  active?: boolean
  online?: boolean
  lastRawGasData?: string | null
  lastGasAt?: string | null
  lastFixType?: string | null
  lastGpsLevel?: string | null
  lastAccuracyMeters?: number | string | null
  simStatus?: number | null
  simPhoneNumber?: string | null
  simDataUsedMb?: number | string | null
  networkType?: string | null
}

export function toFixType(value: unknown): FixType | undefined {
  if (typeof value !== 'string' || !value) return undefined
  return value === 'gps' || value === 'network' || value === 'wifi' ? value : 'other'
}

function toSimStatus(value: unknown): SimStatus | undefined {
  return value === 0 || value === 1 || value === 2 ? value : undefined
}

function toDevice(api: ApiDevice): Device {
  return {
    id: api.deviceId,
    name: api.name?.trim() || shortDeviceName(api.deviceId),
    named: Boolean(api.name?.trim()),
    active: api.active ?? true,
    connectivity: api.networkType === 'wifi' ? 'wifi' : 'sim',
    // Presence is derived from this timestamp rather than from the API's `online` flag, so every screen agrees.
    lastSeenAt: ts(api.lastSeenAt) ?? 0,
    worker: api.workerName?.trim() ? { name: api.workerName.trim(), staffId: api.workerStaffId?.trim() || undefined, phone: api.workerPhone?.trim() || undefined } : undefined,
    activeAlarm: null,
    telemetry: {
      batteryPercent: num(api.lastBatteryLevel),
      lat: num(api.lastLatitude),
      lng: num(api.lastLongitude),
      // The backend works this out (the raw code isn't read here): true, false, or null for unknown.
      isWorn: api.worn === true ? true : api.worn === false ? false : undefined,
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

export async function fetchGasStatus(id: string): Promise<GasStatus | undefined> {
  if (env.useMocks) return getMockGasStatus(id)
  const { data } = await apiClient.get<unknown>(`/devices/${id}/gas`)
  return parseGasStatus(data)
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
