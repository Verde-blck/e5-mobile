import { useSyncExternalStore } from 'react'
import type { HelmetSession } from '../lib/session'
import type { SessionState } from '../types'

const noopSubscribe = () => () => {}
const noState = () => null

/** The live state of a session that already exists (a wall tile), or null while there isn't one. */
export function useSessionState(session: HelmetSession | null): SessionState | null {
  return useSyncExternalStore(session ? session.subscribe : noopSubscribe, session ? session.getState : noState) as SessionState | null
}
