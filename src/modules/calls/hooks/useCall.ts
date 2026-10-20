import { useCallback, useEffect, useReducer, useRef } from 'react'
import { callEngine } from '../lib/engines'
import { callErrorFrom, type CallSession } from '../lib/engine'
import { IDLE, callReducer } from '../lib/callState'

/**
 * Runs one call: asks for the microphone, connects, and keeps the state machine in step with the
 * connection. Leaving the screen ends the call, including a call that was still connecting.
 */
export function useCall(deviceId: string) {
  const [state, dispatch] = useReducer(callReducer, IDLE)
  const session = useRef<CallSession | null>(null)
  const cancelled = useRef(false)

  const start = useCallback(async () => {
    cancelled.current = false
    dispatch({ type: 'start', deviceId })
    if (!(await callEngine.requestMic())) {
      dispatch({ type: 'mic-denied' })
      return
    }
    if (cancelled.current) return
    dispatch({ type: 'mic-ok' })
    try {
      const opened = await callEngine.connect(deviceId, {
        onConnected: () => dispatch({ type: 'connected', now: Date.now() }),
        onEnded: (reason, detail) =>
          dispatch(reason === 'remote-ended' ? { type: 'remote-ended', now: Date.now() } : { type: 'failed', reason: 'dropped', detail }),
      })
      if (cancelled.current) {
        // Hung up while it was still connecting: don't leave an open call behind.
        void opened.hangup().catch(() => {})
        return
      }
      session.current = opened
    } catch (error) {
      const failure = callErrorFrom(error)
      dispatch({ type: 'failed', reason: failure.reason, detail: failure.detail })
    }
  }, [deviceId])

  const hangup = useCallback(async () => {
    cancelled.current = true
    dispatch({ type: 'hangup', now: Date.now() })
    const open = session.current
    session.current = null
    try {
      await open?.hangup()
    } catch {
      /* the call is over on this side either way */
    }
  }, [])

  const setMuted = useCallback((on: boolean) => {
    dispatch({ type: 'mute', on })
    session.current?.setMuted(on)
  }, [])

  const setSpeaker = useCallback((on: boolean) => {
    dispatch({ type: 'speaker', on })
    session.current?.setSpeaker(on)
  }, [])

  useEffect(
    () => () => {
      cancelled.current = true
      void session.current?.hangup().catch(() => {})
      session.current = null
    },
    []
  )

  return { state, start, hangup, setMuted, setSpeaker }
}
