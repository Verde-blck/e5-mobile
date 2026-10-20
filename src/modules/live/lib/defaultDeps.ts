import { AppState } from 'react-native'
import { endLiveForEveryone, startCall, startLive, stopCall } from '../api/live.api'
import { getLocalMedia } from './localMedia'
import type { SessionDeps } from './session'
import { play, push } from './webrtc'

/** The real wiring: the live API, this platform's microphone and WebRTC, and the app's own foreground state. */
export const defaultDeps: SessionDeps = {
  startCall,
  startLive,
  stopCall,
  getLocalMedia,
  play,
  push,
  watchBackground(callback) {
    const subscription = AppState.addEventListener('change', (state) => callback(state !== 'active'))
    return () => subscription.remove()
  },
}

export { endLiveForEveryone }
