import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { serverError, statusOf } from '@/shared/lib/errors'
import type { NetworkSwitchResult, SaveSettingsResult, SiteWifi, SiteWifiInput, UnitSettings } from '../types'
import * as mock from './settings.mock'

interface ApiSiteWifi {
  ssid?: string | null
  passwordSet?: boolean
}

function toSiteWifi(data: ApiSiteWifi | '' | null | undefined): SiteWifi | null {
  if (!data || !data.ssid) return null
  return { ssid: data.ssid, passwordSet: data.passwordSet === true }
}

export async function fetchSiteWifi(): Promise<SiteWifi | null> {
  if (env.useMocks) return mock.getSiteWifi()
  try {
    const { data } = await apiClient.get<ApiSiteWifi | ''>('/settings/site-wifi')
    return toSiteWifi(data)
  } catch (error) {
    if (statusOf(error) === 404) return null
    throw error
  }
}

export async function saveSiteWifi(input: SiteWifiInput): Promise<SiteWifi> {
  if (env.useMocks) return mock.saveSiteWifi(input)
  const body: Record<string, string> = { ssid: input.ssid }
  if (input.password) body.password = input.password
  const { data } = await apiClient.put<ApiSiteWifi>('/settings/site-wifi', body)
  return toSiteWifi(data) ?? { ssid: input.ssid, passwordSet: !!input.password }
}

export async function removeSiteWifi(): Promise<void> {
  if (env.useMocks) return mock.removeSiteWifi()
  await apiClient.delete('/settings/site-wifi')
}

function toBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function toWholeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

export function toUnitSettings(raw: unknown): UnitSettings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return { videoSplitting: toBool(r.videoSplitting), videoSplitMinutes: toWholeNumber(r.videoSplitMinutes) }
}

export async function fetchUnitSettings(deviceId: string): Promise<UnitSettings> {
  if (env.useMocks) return mock.getUnitSettings(deviceId)
  const { data } = await apiClient.get<unknown>(`/devices/${deviceId}/settings`)
  return toUnitSettings(data)
}

// Only the fields given are sent, so nothing else about the helmet's settings is touched.
export async function saveUnitSettings(deviceId: string, patch: UnitSettings): Promise<SaveSettingsResult> {
  if (env.useMocks) return mock.saveUnitSettings(deviceId, patch)
  const body: Record<string, unknown> = {}
  if (patch.videoSplitting !== undefined) body.videoSplitting = patch.videoSplitting
  if (patch.videoSplitMinutes !== undefined) body.videoSplitMinutes = patch.videoSplitMinutes
  const { data } = await apiClient.put<Record<string, unknown>>(`/devices/${deviceId}/settings`, body)
  return {
    saved: data?.saved === true,
    delivered: data?.delivered === true,
    appliesAfterRestart: data?.appliesAfterRestart !== false,
    settings: toUnitSettings(data?.settings),
  }
}

export function isNoSim(error: unknown): boolean {
  return statusOf(error) === 409 && serverError(error).code === 'no_sim'
}

export function noSimMessage(error: unknown): string {
  return serverError(error).message ?? 'The helmet has not reported a SIM card.'
}

// A helmet whose SIM has no data stays offline until it can reach Wi-Fi again (USB or a known hotspot): that is
// why the backend checks for a SIM first and why `force` should only follow an explicit confirmation.
export async function switchToMobileData(deviceId: string, force = false): Promise<NetworkSwitchResult> {
  if (env.useMocks) return mock.switchToMobileData(deviceId, force)
  const { data } = await apiClient.post<{ delivered?: boolean }>(`/devices/${deviceId}/network/mobile`, undefined, {
    params: force ? { force: true } : undefined,
  })
  return { delivered: data?.delivered !== false }
}

export async function switchToWifi(deviceId: string): Promise<NetworkSwitchResult> {
  if (env.useMocks) return mock.switchToWifi(deviceId)
  const { data } = await apiClient.post<{ delivered?: boolean }>(`/devices/${deviceId}/wifi/connect`)
  return { delivered: data?.delivered !== false }
}
