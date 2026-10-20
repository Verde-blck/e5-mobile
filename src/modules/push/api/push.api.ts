import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { statusOf } from '@/shared/lib/errors'

/**
 * The backend's contract (Cypher's reply of 20 Oct 2026; built, going live with the next deploy):
 *
 *   PUT    /api/push/registrations/{installId}   { token, platform: "android", appVersion }  -> 204
 *          (400 invalid_token / invalid_install_id for a malformed token or id)
 *   DELETE /api/push/registrations/{installId}                                               -> 204 (404 if unknown)
 *
 * `token` is the Expo push token (ExponentPushToken[...]): Cypher's backend sends through Expo's push
 * service, which delivers via Google FCM using the key held in E5's Expo account. PUT is an upsert keyed on the signed-in user
 * plus installId, so a refreshed token or a second sign-in updates one record.
 */
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
  // Lets the browser tests see what would have been sent.
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

/** 404 means it was already gone, which is what signing out wants. */
export async function unregisterPush(installId: string): Promise<void> {
  if (env.useMocks) return record({ op: 'unregister', installId })
  try {
    await apiClient.delete(`/push/registrations/${encodeURIComponent(installId)}`)
  } catch (error) {
    if (statusOf(error) === 404) return
    throw error
  }
}
