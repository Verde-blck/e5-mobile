import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { statusOf } from '@/shared/lib/errors'

// PUT is an upsert keyed on the signed-in user plus installId, so a
// refreshed token or a second sign-in updates one record.
export interface PushRegistration {
  installId: string
  token: string
  platform: 'android'
  appVersion: string
}

type MockOp = { op: 'register' | 'unregister'; installId: string; token?: string }
const mockLog: MockOp[] = []

function record(entry: MockOp) {
  mockLog.push(entry)
  ;(globalThis as { __e5PushLog?: MockOp[] }).__e5PushLog = mockLog
}

export async function registerPush(registration: PushRegistration): Promise<void> {
  if (env.useMocks) return record({ op: 'register', installId: registration.installId, token: registration.token })
  await apiClient.put(`/push/registrations/${encodeURIComponent(registration.installId)}`, {
    token: registration.token,
    platform: registration.platform,
    appVersion: registration.appVersion,
  })
}

export async function unregisterPush(installId: string): Promise<void> {
  if (env.useMocks) return record({ op: 'unregister', installId })
  try {
    await apiClient.delete(`/push/registrations/${encodeURIComponent(installId)}`)
  } catch (error) {
    if (statusOf(error) === 404) return
    throw error
  }
}
