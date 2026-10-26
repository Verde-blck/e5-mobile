import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { storage } from '@/shared/lib/storage'
import { MOCK_URL_PREFIX } from '../lib/signalling'
import { GROUP_CALL_MAX } from '../lib/groupPlan'
import { mockReachable, note } from './live.api'

export interface GroupCallHelmet {
  deviceId: string
  delivered: boolean
  watchUrl: string
}

export interface GroupCall {
  callId: string
  helmets: GroupCallHelmet[]
  adminPushUrl: string
}

interface ApiGroupCall {
  callId?: string
  helmets?: { deviceId: string; delivered?: boolean; watchUrl?: string }[]
  adminPushUrl?: string
}

export function toGroupCall(data: ApiGroupCall | null | undefined): GroupCall {
  if (!data?.callId) throw new Error('The backend didn’t return a call.')
  return {
    callId: data.callId,
    helmets: (data.helmets ?? []).map((h) => ({ deviceId: h.deviceId, delivered: h.delivered === true, watchUrl: h.watchUrl ?? '' })),
    adminPushUrl: data.adminPushUrl ?? '',
  }
}

const mockCalls = new Map<string, GroupCall>()

export async function startGroupCall(deviceIds: readonly string[]): Promise<GroupCall> {
  if (env.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const callId = `mock${Date.now().toString(36)}`
    const call: GroupCall = {
      callId,
      helmets: deviceIds.map((deviceId) => ({ deviceId, delivered: mockReachable(deviceId), watchUrl: `${MOCK_URL_PREFIX}watch/${deviceId}` })),
      adminPushUrl: `${MOCK_URL_PREFIX}push/${callId}`,
    }
    mockCalls.set(callId, call)
    note('group-start', deviceIds.join(','))
    return call
  }
  const { data } = await apiClient.post<ApiGroupCall>('/webrtc-group-call/start', { deviceIds: deviceIds.slice(0, GROUP_CALL_MAX) })
  return toGroupCall(data)
}

export async function getGroupCall(callId: string): Promise<GroupCall | null> {
  if (env.useMocks) {
    if (callId === (globalThis as { __e5StaleCall?: string }).__e5StaleCall) return { callId, helmets: [{ deviceId: 'a', delivered: true, watchUrl: '' }, { deviceId: 'b', delivered: true, watchUrl: '' }], adminPushUrl: '' }
    return mockCalls.get(callId) ?? null
  }
  try {
    const { data } = await apiClient.get<ApiGroupCall>(`/webrtc-group-call/${callId}`)
    return toGroupCall(data)
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null
    throw error
  }
}

// Never throws: a call that ends on a bad connection must still end on this side.
export function stopGroupCall(callId: string): Promise<void> {
  if (env.useMocks) {
    mockCalls.delete(callId)
    const g = globalThis as { __e5StaleCall?: string }
    if (g.__e5StaleCall === callId) g.__e5StaleCall = undefined
    note('group-stop', callId)
    return Promise.resolve()
  }
  return apiClient.post(`/webrtc-group-call/${callId}/stop`).then(
    () => undefined,
    () => undefined
  )
}

// Remembered so that if the app is killed mid-call the Group call screen can
// offer to end it: helmets stay in call mode until told otherwise.
const ACTIVE_KEY = 'e5.groupCall'

export const activeGroupCall = {
  async get(): Promise<string | null> {
    try {
      return (await storage.get(ACTIVE_KEY)) ?? ((globalThis as { __e5StaleCall?: string }).__e5StaleCall ?? null)
    } catch {
      return null
    }
  },
  async set(callId: string | null): Promise<void> {
    try {
      if (callId) await storage.set(ACTIVE_KEY, callId)
      else await storage.remove(ACTIVE_KEY)
    } catch {
      // Storage unavailable: offering to end a forgotten call just won't happen.
    }
  },
}
