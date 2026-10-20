import type { PushRegistration } from '../api/push.api'
import type { PushAdapter } from './adapter'
import type { PushStatus } from '../types'

export interface SyncDeps {
  adapter: PushAdapter
  register: (registration: PushRegistration) => Promise<void>
  installId: () => Promise<string>
  appVersion: string
  /** True when the person has just asked to turn alerts on, so the permission prompt may appear. */
  ask: boolean
}

/**
 * Brings this tablet to the best state it can reach for alarm alerts, and says which state that is:
 * channels ready, permission held (asked for only when the person has chosen to), a token fetched,
 * the backend told. The app never asks for notifications out of the blue.
 */
export async function syncPush({ adapter, register, installId, appVersion, ask }: SyncDeps): Promise<PushStatus> {
  if (!adapter.isSupported()) return 'unavailable'
  await adapter.setup()

  let permission = await adapter.permission()
  if (permission === 'undetermined') {
    if (!ask) return 'needs-permission'
    permission = await adapter.requestPermission()
  }
  if (permission !== 'granted') return 'blocked'

  let token: string
  try {
    token = await adapter.getToken()
  } catch {
    // No Google services on the tablet, or this build has no Firebase config: nothing to retry.
    return 'unavailable'
  }

  try {
    await register({ installId: await installId(), token, platform: 'android', appVersion })
  } catch {
    return 'error'
  }
  return 'on'
}
