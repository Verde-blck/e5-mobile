import type { PushRegistration } from '../api/push.api'
import type { PushAdapter } from './adapter'
import type { PushStatus } from '../types'
import { isExpoPushToken } from './expoToken'

export interface SyncDeps {
  adapter: PushAdapter
  register: (registration: PushRegistration) => Promise<void>
  installId: () => Promise<string>
  appVersion: string
  ask: boolean
}

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
    return 'unavailable'
  }

  if (!isExpoPushToken(token)) return 'unavailable'

  try {
    await register({ installId: await installId(), token, platform: 'android', appVersion })
  } catch {
    return 'error'
  }
  return 'on'
}
