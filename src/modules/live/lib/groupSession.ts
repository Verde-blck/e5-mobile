import type { GroupCall } from '../api/groupCall.api'
import type { StreamLike } from '../types'
import { describe, LEAVE_GRACE_MS } from './session'
import { connectWithRetry, type MediaConnection } from './signalling'

export type ParticipantStatus = 'connecting' | 'live' | 'reconnecting' | 'unreachable' | 'failed'

export interface Participant {
  deviceId: string
  status: ParticipantStatus
  stream: StreamLike | null
}

export interface GroupCallState {
  status: 'requesting-media' | 'starting' | 'active' | 'failed' | 'ended'
  error: string | null
  callId: string | null
  participants: Participant[]
  localStream: StreamLike | null
  micOn: boolean
  cameraOn: boolean
  noCamera: boolean
  outgoingFailed: boolean
  startedAt: number | null
  endReason: 'you' | 'left-app' | null
}

export interface GroupDeps {
  startGroupCall(deviceIds: readonly string[]): Promise<GroupCall>
  stopGroupCall(callId: string): Promise<void>
  getLocalMedia(withCamera: boolean): Promise<{ stream: StreamLike; noCamera: boolean }>
  play(url: string, signal: AbortSignal): Promise<MediaConnection>
  push(url: string, media: StreamLike, signal: AbortSignal): Promise<MediaConnection>
  rememberCall(callId: string | null): void
  watchBackground(callback: (inBackground: boolean) => void): () => void
  timing?: { intervalMs?: number; deadlineMs?: number; outgoingDeadlineMs?: number; leaveGraceMs?: number }
}

// Each helmet is its own incoming connection, so one weak signal never
// affects the others; our microphone and camera go out once, to the room.
export class GroupCallSession {
  private state: GroupCallState
  private readonly listeners = new Set<() => void>()
  private readonly controller = new AbortController()
  private readonly incoming = new Map<string, MediaConnection>()
  private outgoing: MediaConnection | null = null
  private call: GroupCall | null = null
  private startSent = false
  private leaveTimer: ReturnType<typeof setTimeout> | null = null
  private readonly stopWatching: () => void

  constructor(
    private readonly deps: GroupDeps,
    private readonly withCamera: boolean
  ) {
    this.state = {
      status: 'requesting-media',
      error: null,
      callId: null,
      participants: [],
      localStream: null,
      micOn: true,
      cameraOn: withCamera,
      noCamera: false,
      outgoingFailed: false,
      startedAt: null,
      endReason: null,
    }
    this.stopWatching = deps.watchBackground((inBackground) => this.onBackground(inBackground))
  }

  getState = (): GroupCallState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(patch: Partial<GroupCallState>) {
    if (this.state.status === 'ended') return
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  private setParticipant(deviceId: string, patch: Partial<Participant>) {
    this.set({ participants: this.state.participants.map((p) => (p.deviceId === deviceId ? { ...p, ...patch } : p)) })
  }

  private get signal() {
    return this.controller.signal
  }

  async start(deviceIds: readonly string[]): Promise<void> {
    try {
      const { stream, noCamera } = await this.deps.getLocalMedia(this.withCamera)
      if (this.signal.aborted) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      this.set({ localStream: stream, status: 'starting', ...(noCamera ? { noCamera: true, cameraOn: false } : {}) })

      this.startSent = true
      const call = await this.deps.startGroupCall(deviceIds)
      this.call = call
      this.deps.rememberCall(call.callId)
      if (this.signal.aborted) {
        void this.deps.stopGroupCall(call.callId)
        this.deps.rememberCall(null)
        return
      }

      this.set({
        status: 'active',
        callId: call.callId,
        startedAt: Date.now(),
        participants: call.helmets.map((h) => ({ deviceId: h.deviceId, status: h.delivered && h.watchUrl ? 'connecting' : 'unreachable', stream: null })),
      })

      if (call.adminPushUrl) void this.connectOutgoing(call.adminPushUrl, stream)
      else this.set({ outgoingFailed: true })

      for (const helmet of call.helmets) if (helmet.delivered && helmet.watchUrl) void this.connectHelmet(helmet.deviceId)
    } catch (error) {
      if (!this.signal.aborted) this.set({ status: 'failed', error: describe(error, this.withCamera) })
    }
  }

  retryHelmet(deviceId: string): void {
    if (this.state.participants.find((p) => p.deviceId === deviceId)?.status === 'failed') void this.connectHelmet(deviceId)
  }

  private async connectHelmet(deviceId: string): Promise<void> {
    const helmet = this.call?.helmets.find((h) => h.deviceId === deviceId)
    if (!helmet) return
    const before = this.state.participants.find((p) => p.deviceId === deviceId)
    this.setParticipant(deviceId, { status: before?.status === 'live' || before?.status === 'reconnecting' ? 'reconnecting' : 'connecting' })

    try {
      const { intervalMs, deadlineMs } = this.deps.timing ?? {}
      const connection = await connectWithRetry(() => this.deps.play(helmet.watchUrl, this.signal), this.signal, { intervalMs, deadlineMs })
      if (this.signal.aborted) {
        connection.close()
        return
      }
      this.incoming.set(deviceId, connection)
      this.setParticipant(deviceId, { status: 'live', stream: connection.stream })
      connection.onLost(() => {
        connection.close()
        if (this.incoming.get(deviceId) === connection) this.incoming.delete(deviceId)
        if (!this.signal.aborted) {
          this.setParticipant(deviceId, { status: 'reconnecting' })
          void this.connectHelmet(deviceId)
        }
      })
    } catch {
      if (!this.signal.aborted) this.setParticipant(deviceId, { status: 'failed', stream: null })
    }
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

  toggleMic(): void {
    const next = !this.state.micOn
    this.state.localStream?.getAudioTracks().forEach((t) => (t.enabled = next))
    this.set({ micOn: next })
  }

  toggleCamera(): void {
    if (this.state.noCamera || !this.withCamera) return
    const next = !this.state.cameraOn
    this.state.localStream?.getVideoTracks().forEach((t) => (t.enabled = next))
    this.set({ cameraOn: next })
  }

  end(reason: 'you' | 'left-app' = 'you'): void {
    if (this.state.status === 'ended') return
    if (this.leaveTimer) clearTimeout(this.leaveTimer)
    this.leaveTimer = null
    this.stopWatching()
    this.controller.abort()

    this.incoming.forEach((c) => c.close())
    this.incoming.clear()
    this.outgoing?.close()
    this.state.localStream?.getTracks().forEach((t) => t.stop())

    if (this.startSent && this.call) {
      void this.deps.stopGroupCall(this.call.callId)
      this.deps.rememberCall(null)
    }
    this.state = { ...this.state, status: 'ended', localStream: null, participants: this.state.participants.map((p) => ({ ...p, stream: null })), endReason: reason }
    this.listeners.forEach((l) => l())
  }

  private onBackground(inBackground: boolean) {
    if (this.leaveTimer) clearTimeout(this.leaveTimer)
    this.leaveTimer = null
    if (!inBackground || this.state.status === 'requesting-media' || this.state.status === 'ended') return
    this.leaveTimer = setTimeout(() => this.end('left-app'), this.deps.timing?.leaveGraceMs ?? LEAVE_GRACE_MS)
  }
}
