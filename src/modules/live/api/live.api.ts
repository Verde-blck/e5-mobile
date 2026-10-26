import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { getMockFleet } from '@/modules/devices/api/devices.mock'
import { derivePresence } from '@/modules/devices/lib/presence'
import { MOCK_URL_PREFIX } from '../lib/signalling'
import type { CallStart, LiveStart } from '../types'

export const liveAvailable = () => env.useMocks || env.liveEnabled

type LogEntry = { op: string; deviceId: string }
const log: LogEntry[] = []
export function note(op: string, deviceId: string) {
  log.push({ op, deviceId })
  ;(globalThis as { __e5CallLog?: LogEntry[] }).__e5CallLog = log
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function mockReachable(deviceId: string): boolean {
  const device = getMockFleet().find((d) => d.id === deviceId)
  return !!device && device.active && derivePresence(device.lastSeenAt, Date.now()) !== 'offline'
}

export async function startLive(deviceId: string): Promise<LiveStart> {
  if (env.useMocks) {
    await wait(500)
    note('live-start', deviceId)
    return { delivered: mockReachable(deviceId), watchUrl: `${MOCK_URL_PREFIX}watch/${deviceId}` }
  }
  const { data } = await apiClient.post<Partial<LiveStart>>(`/devices/${deviceId}/live/start`)
  return { delivered: data?.delivered === true, watchUrl: data?.watchUrl ?? '', alreadyLive: data?.alreadyLive === true }
}

export async function startCall(deviceId: string): Promise<CallStart> {
  if (env.useMocks) {
    await wait(500)
    if ((globalThis as { __e5CallDeny?: boolean }).__e5CallDeny) throw Object.assign(new Error('HTTP 403'), { response: { status: 403, data: { error: 'forbidden' } } })
    note('call-start', deviceId)
    return { delivered: mockReachable(deviceId), watchUrl: `${MOCK_URL_PREFIX}watch/${deviceId}`, adminPushUrl: `${MOCK_URL_PREFIX}push/${deviceId}` }
  }
  const { data } = await apiClient.post<Partial<CallStart>>(`/devices/${deviceId}/webrtc-call/start`)
  return { delivered: data?.delivered === true, watchUrl: data?.watchUrl ?? '', adminPushUrl: data?.adminPushUrl ?? '' }
}

// Never throws: a call that ends on a bad connection must still end on this side.
export function stopCall(deviceId: string): Promise<void> {
  if (env.useMocks) {
    note('call-stop', deviceId)
    return Promise.resolve()
  }
  return apiClient.post(`/devices/${deviceId}/webrtc-call/stop`).then(
    () => undefined,
    () => undefined
  )
}

export async function endLiveForEveryone(deviceId: string): Promise<void> {
  if (env.useMocks) {
    note('live-stop', deviceId)
    return
  }
  await apiClient.post(`/devices/${deviceId}/live/stop`)
}
