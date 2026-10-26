import { getMockDevice, setMockNetwork } from '@/modules/devices/api/devices.mock'
import type { NetworkSwitchResult, SaveSettingsResult, SiteWifi, SiteWifiInput, UnitSettings } from '../types'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function httpError(status: number, body?: object) {
  const error = new Error(`HTTP ${status}`) as Error & { response?: { status: number; data?: object } }
  error.response = { status, data: body }
  return error
}

let siteWifi: SiteWifi | null = { ssid: 'E5ENERGY', passwordSet: true }

export async function getSiteWifi(): Promise<SiteWifi | null> {
  await delay(200)
  return siteWifi ? { ...siteWifi } : null
}

export async function saveSiteWifi(input: SiteWifiInput): Promise<SiteWifi> {
  await delay(300)
  siteWifi = { ssid: input.ssid, passwordSet: input.password ? true : (siteWifi?.passwordSet ?? false) }
  return { ...siteWifi }
}

export async function removeSiteWifi(): Promise<void> {
  await delay(300)
  siteWifi = null
}

const settings = new Map<string, UnitSettings>()
const DEFAULTS: UnitSettings = { videoSplitting: true, videoSplitMinutes: 10 }

export async function getUnitSettings(deviceId: string): Promise<UnitSettings> {
  await delay(200)
  return { ...DEFAULTS, ...settings.get(deviceId) }
}

export async function saveUnitSettings(deviceId: string, patch: UnitSettings): Promise<SaveSettingsResult> {
  await delay(300)
  const next = { ...DEFAULTS, ...settings.get(deviceId), ...patch }
  settings.set(deviceId, next)
  const device = getMockDevice(deviceId)
  const isReachable = !!device && reachable(device.lastSeenAt)
  return { saved: true, delivered: isReachable, appliesAfterRestart: true, settings: next }
}

const reachable = (lastSeenAt: number) => Date.now() - lastSeenAt < 10 * 60_000

export async function switchToMobileData(deviceId: string, force: boolean): Promise<NetworkSwitchResult> {
  await delay(400)
  const device = getMockDevice(deviceId)
  if (!device) throw httpError(404)
  if (device.telemetry.simStatus !== 1 && !force) {
    throw httpError(409, { error: 'no_sim', message: 'The helmet has not reported a SIM card. Switching it to mobile data could leave it offline.' })
  }
  setMockNetwork(deviceId, '4g')
  return { delivered: reachable(device.lastSeenAt) }
}

export async function switchToWifi(deviceId: string): Promise<NetworkSwitchResult> {
  await delay(400)
  const device = getMockDevice(deviceId)
  if (!device) throw httpError(404)
  setMockNetwork(deviceId, 'wifi')
  return { delivered: reachable(device.lastSeenAt) }
}
