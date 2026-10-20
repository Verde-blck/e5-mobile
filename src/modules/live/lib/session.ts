import { isForbidden } from '@/shared/lib/errors'
import type { CallStart, LiveStart, SessionMode, SessionState, StreamLike } from '../types'
import { NotReadyError, connectWithRetry, type MediaConnection } from './signalling'

/** Everything platform-specific, handed in so the session can be tested with fakes. */
export interface SessionDeps {
  startCall(deviceId: string): Promise<CallStart>
  startLive(deviceId: string): Promise<LiveStart>
  stopCall(deviceId: string): Promise<void>
  /** The microphone. Rejects with the platform's own permission error. */
  getLocalMedia(): Promise<StreamLike>
  play(url: string, signal: AbortSignal): Promise<MediaConnection>
  push(url: string, media: StreamLike, signal: AbortSignal): Promise<MediaConnection>
  /** Reports the app going to the background (true) and coming back (false); returns how to stop listening. */
  watchBackground(callback: (inBackground: boolean) => void): () => void
  /** Tests only: shorter timings than the real ones (2 s between tries, 30 s to give up, 4 s out of sight). */
  timing?: { intervalMs?: number; deadlineMs?: number; outgoingDeadlineMs?: number; leaveGraceMs?: number }
}

/**
 * How long the app may be out of sight before the session ends. Android briefly pauses the app for its own
 * dialogs (the microphone permission) and for the notification shade, so a glance away mustn't end a call.
 */
export const LEAVE_GRACE_MS = 4_000

const INITIAL: SessionState = {
  status: 'starting',
  error: null,
  remoteStream: null,
  localStream: null,
  micOn: true,
  outgoingFailed: false,
  liveSince: null,
  endReason: null,
}

/**
 * One live view or one call with one helmet, from start to hang-up. (Ported from the web dashboard's HelmetSession.)
 *
 * A plain object rather than React state, because its lifetime is the session's, not a component's.
 *
 * Ending works differently for the two modes, as the backend specifies:
 * - Live view: end() only closes this tablet's connection. Others may be watching the same helmet, and the media
 *   server stops the helmet itself about 20 seconds after the last viewer leaves.
 * - Call: end() also takes the helmet out of call mode, on every way out.
 *
 * Unlike the browser, a tablet app can't be left running in the background and keep a call: a call or live view
 * ends if the app stays out of sight for LEAVE_GRACE_MS.
 */
export class HelmetSession {
  private state: SessionState
  private readonly listeners = new Set<() => void>()
  private readonly controller = new AbortController()
  private remote: MediaConnection | null = null
  private outgoing: MediaConnection | null = null
  private startSent = false
  private watchUrl = ''
  private leaveTimer: ReturnType<typeof setTimeout> | null = null
  private readonly stopWatching: () => void

  constructor(
    readonly deviceId: string,
    readonly mode: SessionMode,
    private readonly deps: SessionDeps
  ) {
    this.state = { ...INITIAL, status: mode === 'call' ? 'requesting-media' : 'starting' }
    this.stopWatching = deps.watchBackground((inBackground) => this.onBackground(inBackground))
  }

  // --- For useSyncExternalStore -----------------------------------------

  getState = (): SessionState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(patch: Partial<SessionState>) {
    if (this.state.status === 'ended') return
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  private get signal() {
    return this.controller.signal
  }

  // --- Lifecycle --------------------------------------------------------

  async start(): Promise<void> {
    try {
      let local: StreamLike | null = null
      if (this.mode === 'call') {
        // Ask for the microphone before touching the helmet: if it is refused, the helmet never gets put into call mode.
        local = await this.deps.getLocalMedia()
        if (this.signal.aborted) {
          local.getTracks().forEach((t) => t.stop())
          return
        }
        this.set({ localStream: local, status: 'starting' })
      }

      // Marked before the request goes out, so a call ended mid-request still takes the helmet out of call mode.
      this.startSent = true
      const call = this.mode === 'call' ? await this.deps.startCall(this.deviceId) : null
      const started = call ?? (await this.deps.startLive(this.deviceId))

      if (this.signal.aborted) {
        // Ended while the start request was in flight; make sure the stop lands after the start.
        if (this.mode === 'call') void this.deps.stopCall(this.deviceId)
        return
      }
      if (!started.delivered) {
        // Offline. Live view and call commands aren't queued, so nothing will happen later.
        this.set({ status: 'offline' })
        return
      }
      if (!started.watchUrl) throw new Error('The backend returned no stream address.')
      this.watchUrl = started.watchUrl

      if (call && local) {
        if (!call.adminPushUrl) throw new Error('The backend returned no address to send your voice to.')
        void this.connectOutgoing(call.adminPushUrl, local)
      }
      await this.connectRemote()
    } catch (error) {
      if (this.signal.aborted) return
      this.set({ status: 'failed', error: describe(error) })
    }
  }

  /** After a failed connection: try to get the picture again without re-sending start. */
  retry(): void {
    if (this.state.status !== 'failed' || !this.watchUrl) return
    this.set({ error: null })
    void this.connectRemote().catch((error) => {
      if (!this.signal.aborted) this.set({ status: 'failed', error: describe(error) })
    })
  }

  end(reason: 'you' | 'left-app' = 'you'): void {
    if (this.state.status === 'ended') return
    if (this.leaveTimer) clearTimeout(this.leaveTimer)
    this.leaveTimer = null
    this.stopWatching()
    this.controller.abort()

    this.remote?.close()
    this.outgoing?.close()
    // Turns the microphone off: leaving tracks running keeps it on.
    this.state.localStream?.getTracks().forEach((t) => t.stop())

    // Live view sends nothing: see the class comment.
    if (this.mode === 'call' && this.startSent) void this.deps.stopCall(this.deviceId)

    this.state = { ...this.state, status: 'ended', remoteStream: null, localStream: null, endReason: reason }
    this.listeners.forEach((l) => l())
  }

  private onBackground(inBackground: boolean) {
    if (this.leaveTimer) clearTimeout(this.leaveTimer)
    this.leaveTimer = null
    // While the permission dialog is up the app is paused too: that is not leaving.
    if (!inBackground || this.state.status === 'requesting-media' || this.state.status === 'ended') return
    this.leaveTimer = setTimeout(() => this.end('left-app'), this.deps.timing?.leaveGraceMs ?? LEAVE_GRACE_MS)
  }

  // --- Connections ------------------------------------------------------

  private async connectRemote(): Promise<void> {
    const reconnecting = this.state.liveSince !== null
    this.set({ status: reconnecting ? 'reconnecting' : 'connecting' })

    const { intervalMs, deadlineMs } = this.deps.timing ?? {}
    const connection = await connectWithRetry(() => this.deps.play(this.watchUrl, this.signal), this.signal, { intervalMs, deadlineMs })
    if (this.signal.aborted) {
      connection.close()
      return
    }

    this.remote = connection
    this.set({ status: 'live', remoteStream: connection.stream, liveSince: this.state.liveSince ?? Date.now() })

    connection.onLost(() => {
      connection.close()
      if (this.remote === connection) this.remote = null
      if (this.signal.aborted) return
      void this.connectRemote().catch((error) => {
        if (!this.signal.aborted) {
          this.set({
            status: 'failed',
            error: error instanceof NotReadyError ? 'The picture was lost and didn’t come back. The helmet may have a weak signal.' : describe(error),
          })
        }
      })
    })
  }

  private async connectOutgoing(pushUrl: string, local: StreamLike): Promise<void> {
    try {
      this.outgoing = await connectWithRetry(() => this.deps.push(pushUrl, local, this.signal), this.signal, {
        intervalMs: this.deps.timing?.intervalMs,
        deadlineMs: this.deps.timing?.outgoingDeadlineMs ?? 20_000,
      })
      if (this.signal.aborted) this.outgoing.close()
    } catch {
      if (!this.signal.aborted) this.set({ outgoingFailed: true })
    }
  }

  // --- Call controls ----------------------------------------------------

  toggleMic(): void {
    const next = !this.state.micOn
    this.state.localStream?.getAudioTracks().forEach((t) => (t.enabled = next))
    this.set({ micOn: next })
  }
}

/** A sentence an operator can act on, for anything that can go wrong. */
export function describe(error: unknown): string {
  const name = (error as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return "The microphone is blocked. Allow it in the tablet's settings, then try again."
  if (name === 'NotFoundError') return 'No microphone was found on this tablet.'
  if (name === 'NotReadableError') return 'The microphone is being used by another app. Close it and try again.'
  if (error instanceof NotReadyError) return 'The helmet didn’t start sending video within 30 seconds. It may have a weak signal.'
  // A 403 {"error":"forbidden"} refuses this action; it does not mean the sign-in has ended (a bare 401 or 403 does).
  if (isForbidden(error)) return 'You can’t do that with this helmet. Calls need the right permission, or an open SOS alarm for it.'
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 401 || status === 403) return 'Your session has expired. Sign in again.'
  // react-native-webrtc reports a refused permission as a plain error whose message says so.
  if (error instanceof Error && /permission/i.test(error.message)) return "The microphone is blocked. Allow it in the tablet's settings, then try again."
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong connecting to the helmet.'
}
