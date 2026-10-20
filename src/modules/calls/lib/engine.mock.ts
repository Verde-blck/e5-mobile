import { getMockDevice } from '@/modules/devices/api/devices.mock'
import { derivePresence } from '@/modules/devices/lib/presence'
import { CallError, type CallCallbacks, type CallEngine, type CallSession } from './engine'

/**
 * A simulated call, for the browser preview and for demos in sample-data mode. It sets up in about
 * a second and "connects" a moment later. It is NOT a call: no audio goes anywhere. The test hooks
 * on `globalThis` let the browser tests block the microphone, refuse the call, or have the helmet
 * hang up.
 */
type Hooks = typeof globalThis & {
  __e5MicDeny?: boolean
  __e5CallDeny?: boolean
  __e5CallRemoteEnd?: () => void
  __e5CallLog?: Array<{ op: string; deviceId?: string; value?: boolean }>
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const note = (entry: { op: string; deviceId?: string; value?: boolean }) => {
  const g = globalThis as Hooks
  g.__e5CallLog = [...(g.__e5CallLog ?? []), entry]
}

export const mockCallEngine: CallEngine = {
  isSupported: () => true,

  async requestMic() {
    await delay(150)
    return !(globalThis as Hooks).__e5MicDeny
  },

  async connect(deviceId: string, callbacks: CallCallbacks): Promise<CallSession> {
    await delay(700)
    const g = globalThis as Hooks
    if (g.__e5CallDeny) throw new CallError('not-allowed')
    const device = getMockDevice(deviceId)
    if (!device || derivePresence(device.lastSeenAt, Date.now()) === 'offline') throw new CallError('unreachable')

    note({ op: 'connect', deviceId })
    let open = true
    const timer = setTimeout(() => open && callbacks.onConnected(), 600)
    g.__e5CallRemoteEnd = () => {
      if (!open) return
      open = false
      callbacks.onEnded('remote-ended')
    }
    return {
      async hangup() {
        open = false
        clearTimeout(timer)
        note({ op: 'hangup', deviceId })
      },
      setMuted: (muted) => note({ op: 'mute', deviceId, value: muted }),
      setSpeaker: (on) => note({ op: 'speaker', deviceId, value: on }),
    }
  },
}
