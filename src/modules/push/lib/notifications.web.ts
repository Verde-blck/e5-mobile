import type { PermissionState, PushAdapter } from './adapter'

type Hooks = typeof globalThis & {
  __e5PushPermission?: PermissionState
  __e5PushDeny?: boolean
  __e5PushTests?: number
  __e5PushDismissed?: string[]
  __e5PushTap?: (data: unknown) => void
  __e5PushReceive?: (data: unknown) => void
}

let permission: PermissionState = 'undetermined'
const tapListeners = new Set<(data: unknown) => void>()
const receiveListeners = new Set<(data: unknown) => void>()

export const notifications: PushAdapter = {
  isSupported: () => true,

  async setup() {
    const g = globalThis as Hooks
    if (g.__e5PushPermission) permission = g.__e5PushPermission
    g.__e5PushTap = (data) => tapListeners.forEach((cb) => cb(data))
    g.__e5PushReceive = (data) => receiveListeners.forEach((cb) => cb(data))
  },

  async permission() {
    return permission
  },

  async requestPermission() {
    permission = (globalThis as Hooks).__e5PushDeny ? 'denied' : 'granted'
    return permission
  },

  async getToken() {
    return 'ExponentPushToken[mock-token]'
  },

  onTokenChange: () => () => {},

  onReceive(callback) {
    receiveListeners.add(callback)
    return () => receiveListeners.delete(callback)
  },

  onTap(callback) {
    tapListeners.add(callback)
    return () => tapListeners.delete(callback)
  },

  initialTap: () => null,

  async dismiss(alarmId) {
    const g = globalThis as Hooks
    g.__e5PushDismissed = [...(g.__e5PushDismissed ?? []), alarmId]
  },

  async sendTest() {
    const g = globalThis as Hooks
    g.__e5PushTests = (g.__e5PushTests ?? 0) + 1
  },

  async openSettings() {},
  async openBatterySettings() {},
}
