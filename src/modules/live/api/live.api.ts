import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { getMockFleet } from '@/modules/devices/api/devices.mock'
import { derivePresence } from '@/modules/devices/lib/presence'
import { MOCK_URL_PREFIX } from '../lib/signalling'
import type { CallStart, LiveStart } from '../types'

/*
 * Live view and calls, from the backend's Helmet Video & Live Stream guide (12 Oct 2026) and the web dashboard.
 *
 * The backend only tells the helmet what to do and hands back URLs. The picture and sound flow between this tablet
 * and the media server over WebRTC (lib/signalling.ts). Only the HTTPS media-server URLs from these answers are used.
 */

/** Whether the app offers live view and calls at all (never a button that can only fail). */
export const liveAvailable = () => env.useMocks || env.liveEnabled

type LogEntry = { op: string; deviceId: string }
const log: LogEntry[] = []
export function note(op: string, deviceId: string) {
  log.push({ op, deviceId })
  ;(globalThis as { __e5CallLog?: LogEntry[] }).__e5CallLog = log // lets the browser tests see what was sent
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Sample data: a helmet that is offline or deactivated doesn't receive the command, like the real thing. */
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
  // Every viewer calls start. If the helmet is already streaming, the backend doesn't restart it; the answer says
  // alreadyLive and we just join.
  const { data } = await apiClient.post<Partial<LiveStart>>(`/devices/${deviceId}/live/start`)
  return { delivered: data?.delivered === true, watchUrl: data?.watchUrl ?? '', alreadyLive: data?.alreadyLive === true }
}

export async function startCall(deviceId: string): Promise<CallStart> {
  if (env.useMocks) {
    await wait(500)
    // test hook: the backend refusing the call (no permission and no open SOS)
    if ((globalThis as { __e5CallDeny?: boolean }).__e5CallDeny) throw Object.assign(new Error('HTTP 403'), { response: { status: 403, data: { error: 'forbidden' } } })
    note('call-start', deviceId)
    return { delivered: mockReachable(deviceId), watchUrl: `${MOCK_URL_PREFIX}watch/${deviceId}`, adminPushUrl: `${MOCK_URL_PREFIX}push/${deviceId}` }
  }
  const { data } = await apiClient.post<Partial<CallStart>>(`/devices/${deviceId}/webrtc-call/start`)
  return { delivered: data?.delivered === true, watchUrl: data?.watchUrl ?? '', adminPushUrl: data?.adminPushUrl ?? '' }
}

/**
 * Takes the helmet out of call mode. Sent on every way a call ends. Never throws: a call that ends on a bad
 * connection must still end on this side.
 */
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

/**
 * Stops a helmet's live stream for every viewer, not just this one.
 *
 * Closing a live view never calls this. Several people can watch one helmet, and the media server stops the helmet by
 * itself about 20 seconds after the last viewer leaves. This is only for an operator who explicitly wants it to stop now.
 */
export async function endLiveForEveryone(deviceId: string): Promise<void> {
  if (env.useMocks) {
    note('live-stop', deviceId)
    return
  }
  await apiClient.post(`/devices/${deviceId}/live/stop`)
}
