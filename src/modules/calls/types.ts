/** Where a call stands, in order: asking for the microphone, connecting, in the call, then ended or failed. */
export type CallPhase = 'idle' | 'mic-permission' | 'connecting' | 'active' | 'ended' | 'failed'

/** Why a call isn't going on any more. */
export type EndReason =
  | 'hung-up' // this tablet ended it
  | 'remote-ended' // the helmet ended it
  | 'mic-denied' // the microphone is blocked
  | 'not-allowed' // the backend refused: no permission, and no open SOS alarm
  | 'unreachable' // the helmet is offline or didn't answer
  | 'dropped' // the connection was lost mid-call
  | 'failed' // anything else

export interface CallState {
  phase: CallPhase
  deviceId?: string
  /** When the call connected, for the timer. */
  startedAt?: number
  /** When it ended, for how long it lasted. */
  endedAt?: number
  muted: boolean
  speaker: boolean
  reason?: EndReason
  detail?: string
}

export type CallEvent =
  | { type: 'start'; deviceId: string }
  | { type: 'mic-ok' }
  | { type: 'mic-denied' }
  | { type: 'connected'; now: number }
  | { type: 'failed'; reason: Exclude<EndReason, 'hung-up' | 'remote-ended'>; detail?: string }
  | { type: 'hangup'; now: number }
  | { type: 'remote-ended'; now: number }
  | { type: 'mute'; on: boolean }
  | { type: 'speaker'; on: boolean }
  | { type: 'reset' }
