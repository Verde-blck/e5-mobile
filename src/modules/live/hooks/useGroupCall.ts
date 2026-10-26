import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { activeGroupCall, startGroupCall, stopGroupCall } from '../api/groupCall.api'
import { getLocalMedia } from '../lib/localMedia'
import { GroupCallSession, type GroupCallState, type GroupDeps } from '../lib/groupSession'
import { play, push } from '../lib/webrtc'

const deps: GroupDeps = {
  startGroupCall,
  stopGroupCall,
  getLocalMedia,
  play,
  push,
  rememberCall: (callId) => void activeGroupCall.set(callId),
  watchBackground(callback) {
    const subscription = AppState.addEventListener('change', (state) => callback(state !== 'active'))
    return () => subscription.remove()
  },
}

const noopSubscribe = () => () => {}
const noState = () => null

// Starting one sends every helmet into call mode, so it must never happen twice by accident:
// callers begin from a timer that React's undo cancels, and leaving the screen hangs up.
export function useGroupCall() {
  const [session, setSession] = useState<GroupCallSession | null>(null)
  const ref = useRef<GroupCallSession | null>(null)
  const state = useSyncExternalStore(session ? session.subscribe : noopSubscribe, session ? session.getState : noState) as GroupCallState | null

  const begin = useCallback((deviceIds: readonly string[], withCamera: boolean) => {
    ref.current?.end()
    const next = new GroupCallSession(deps, withCamera)
    ref.current = next
    setSession(next)
    void next.start(deviceIds)
  }, [])

  const end = useCallback(() => {
    ref.current?.end()
  }, [])

  useEffect(
    () => () => {
      ref.current?.end()
    },
    []
  )

  return { session, state, begin, end }
}
