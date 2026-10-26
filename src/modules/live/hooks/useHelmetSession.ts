import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { HelmetSession } from '../lib/session'
import { defaultDeps } from '../lib/defaultDeps'
import type { SessionMode, SessionState } from '../types'

const noopSubscribe = () => () => {}
const noState = () => null

// Starting a session sends the helmet a command, so it must never happen twice by accident.
export function useHelmetSession(deviceId: string) {
  const [session, setSession] = useState<HelmetSession | null>(null)
  const sessionRef = useRef<HelmetSession | null>(null)

  const state = useSyncExternalStore(session ? session.subscribe : noopSubscribe, session ? session.getState : noState) as SessionState | null

  const begin = useCallback(
    (mode: SessionMode, options: { withCamera?: boolean } = {}) => {
      sessionRef.current?.end()
      const next = new HelmetSession(deviceId, mode, defaultDeps, options.withCamera ?? false)
      sessionRef.current = next
      setSession(next)
      void next.start()
    },
    [deviceId]
  )

  const end = useCallback(() => {
    sessionRef.current?.end()
  }, [])

  useEffect(
    () => () => {
      sessionRef.current?.end()
    },
    []
  )

  return { session, state, begin, end }
}
