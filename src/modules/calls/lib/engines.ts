import { env } from '@/config/env'
import type { CallEngine } from './engine'
import { mockCallEngine } from './engine.mock'

/**
 * Real calls are not built yet: they need the backend's signalling (what `webrtc-call/start`
 * returns and how audio is set up and torn down), which I don't have. Until then a real build
 * reports calls as unsupported, so no Call button is shown that can't work.
 *
 * To finish: write a WebRTC engine that implements CallEngine (react-native-webrtc, with its Expo
 * config plugin; see docs/CALLS.md) and return it here instead of this placeholder.
 */
const unavailable: CallEngine = {
  isSupported: () => false,
  requestMic: async () => false,
  connect: async () => {
    throw new Error('Calls are not available in this build.')
  },
}

export const callEngine: CallEngine = env.useMocks ? mockCallEngine : unavailable
