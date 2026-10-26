import { useSyncExternalStore } from 'react'
import type { HelmetSession } from '../lib/session'
import type { SessionState } from '../types'

const noopSubscribe = () => () => {}
const noState = () => null

export function useSessionState(session: HelmetSession | null): SessionState | null {
  return useSyncExternalStore(session ? session.subscribe : noopSubscribe, session ? session.getState : noState) as SessionState | null
}
