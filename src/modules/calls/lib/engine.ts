import { isForbidden, statusOf } from '@/shared/lib/errors'
import type { EndReason } from '../types'

/** A call in progress, as the screen controls it. */
export interface CallSession {
  hangup(): Promise<void>
  setMuted(muted: boolean): void
  setSpeaker(on: boolean): void
}

export interface CallCallbacks {
  /** Audio is flowing both ways. */
  onConnected(): void
  /** The call is over without this tablet hanging up. */
  onEnded(reason: 'remote-ended' | 'dropped', detail?: string): void
}

/**
 * The one seam between the app and the call technology. The screens, state machine and access rule
 * don't know whether a call is WebRTC, SIP or a simulation: swapping the engine is the only change
 * once the backend's signalling is known. See engines.ts.
 */
export interface CallEngine {
  /** False means "don't offer calls at all" (no non-working button is ever shown). */
  isSupported(): boolean
  /** Asks for the microphone if needed; true when the app may use it. */
  requestMic(): Promise<boolean>
  /** Starts the call and resolves once it is set up; rejects with a CallError. Connection arrives through callbacks. */
  connect(deviceId: string, callbacks: CallCallbacks): Promise<CallSession>
}

export class CallError extends Error {
  constructor(
    public reason: Exclude<EndReason, 'hung-up' | 'remote-ended' | 'mic-denied' | 'dropped'>,
    public detail?: string
  ) {
    super(reason)
  }
}

/** A failed request to start a call, as a CallError: refused, helmet unreachable, or something else. */
export function callErrorFrom(error: unknown): CallError {
  if (error instanceof CallError) return error
  // A 403 {"error":"forbidden"} is a refusal of this call (no permission and no open SOS), not a dead session.
  if (isForbidden(error)) return new CallError('not-allowed')
  const status = statusOf(error)
  if (status === 404 || status === 409 || status === 502 || status === 503 || status === 504) return new CallError('unreachable')
  return new CallError('failed', error instanceof Error ? error.message : undefined)
}
