import type { CallEvent, CallState } from '../types'

export const IDLE: CallState = { phase: 'idle', muted: false, speaker: false }

const LIVE = ['mic-permission', 'connecting', 'active'] as const
const isLive = (phase: CallState['phase']) => (LIVE as readonly string[]).includes(phase)

/**
 * The call's state machine. An event that doesn't make sense in the current phase (a "connected"
 * after hanging up, a second "start" during a call) is ignored, so late callbacks from the
 * connection can never revive or corrupt a finished call.
 */
export function callReducer(state: CallState, event: CallEvent): CallState {
  switch (event.type) {
    case 'start':
      return isLive(state.phase) ? state : { ...IDLE, phase: 'mic-permission', deviceId: event.deviceId }
    case 'mic-ok':
      return state.phase === 'mic-permission' ? { ...state, phase: 'connecting' } : state
    case 'mic-denied':
      return state.phase === 'mic-permission' ? { ...state, phase: 'failed', reason: 'mic-denied' } : state
    case 'connected':
      return state.phase === 'connecting' ? { ...state, phase: 'active', startedAt: event.now } : state
    case 'failed':
      return isLive(state.phase) ? { ...state, phase: 'failed', reason: event.reason, detail: event.detail } : state
    case 'hangup':
      return isLive(state.phase) ? { ...state, phase: 'ended', reason: 'hung-up', endedAt: event.now } : state
    case 'remote-ended':
      return state.phase === 'connecting' || state.phase === 'active' ? { ...state, phase: 'ended', reason: 'remote-ended', endedAt: event.now } : state
    case 'mute':
      return state.phase === 'active' || state.phase === 'connecting' ? { ...state, muted: event.on } : state
    case 'speaker':
      return state.phase === 'active' || state.phase === 'connecting' ? { ...state, speaker: event.on } : state
    case 'reset':
      return IDLE
  }
}

/** 83 seconds -> "01:23"; an hour or more -> "1:02:03". */
export function formatCallTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export interface CallCopy {
  title: string
  detail?: string
  tone: 'progress' | 'ok' | 'warn' | 'done'
  /** What the main button should offer once the call is over. */
  action?: 'retry' | 'settings'
}

/** What to say about the call, in each state. */
export function describeCall(state: CallState, name: string): CallCopy {
  switch (state.phase) {
    case 'idle':
    case 'mic-permission':
      return { tone: 'progress', title: 'Asking for the microphone…' }
    case 'connecting':
      return { tone: 'progress', title: `Calling ${name}…` }
    case 'active':
      return { tone: 'ok', title: `In a call with ${name}` }
    case 'ended': {
      const lasted = state.startedAt && state.endedAt ? ` It lasted ${formatCallTime(state.endedAt - state.startedAt)}.` : ''
      return state.reason === 'remote-ended'
        ? { tone: 'done', title: `${name} ended the call`, detail: lasted.trim() || undefined }
        : { tone: 'done', title: 'Call ended', detail: lasted.trim() || undefined }
    }
    case 'failed':
      switch (state.reason) {
        case 'mic-denied':
          return { tone: 'warn', title: 'The microphone is blocked', detail: "Allow it in the tablet's settings so you can speak to the helmet.", action: 'settings' }
        case 'not-allowed':
          return { tone: 'warn', title: "You can't call this helmet", detail: 'Calls need the right permission, or an open SOS alarm for that helmet.' }
        case 'unreachable':
          return { tone: 'warn', title: `Can't reach ${name}`, detail: "It looks offline. Try again when it's back online.", action: 'retry' }
        case 'dropped':
          return { tone: 'warn', title: 'The call dropped', detail: 'The connection was lost.', action: 'retry' }
        default:
          return { tone: 'warn', title: "The call couldn't connect", detail: 'Check the connection and try again.', action: 'retry' }
      }
  }
}
