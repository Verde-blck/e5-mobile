export interface TrackLike {
  enabled: boolean
  stop(): void
}

export interface StreamLike {
  getTracks(): TrackLike[]
  getAudioTracks(): TrackLike[]
  getVideoTracks(): TrackLike[]
}

export type SessionMode = 'watch' | 'call'

export type SessionStatus =
  | 'requesting-media'
  | 'starting'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'offline'
  | 'failed'
  | 'ended'

export interface SessionState {
  status: SessionStatus
  error: string | null
  remoteStream: StreamLike | null
  localStream: StreamLike | null
  micOn: boolean
  cameraOn: boolean
  noCamera: boolean
  outgoingFailed: boolean
  liveSince: number | null
  endReason: 'you' | 'left-app' | null
}

export interface LiveStart {
  delivered: boolean
  watchUrl: string
  alreadyLive?: boolean
}

export interface CallStart extends LiveStart {
  adminPushUrl: string
}
