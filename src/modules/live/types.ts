/** What the session needs of a media track, whether it comes from a browser or from react-native-webrtc. */
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
  | 'requesting-media' // call only: waiting for the microphone permission
  | 'starting' // asking the backend to start the helmet
  | 'connecting' // helmet told; waiting for its first picture (5 to 10 s)
  | 'live'
  | 'reconnecting' // picture dropped; trying to get it back
  | 'offline' // helmet didn't receive the start command
  | 'failed'
  | 'ended'

export interface SessionState {
  status: SessionStatus
  error: string | null
  /** The helmet's picture and sound. */
  remoteStream: StreamLike | null
  /** Call only: our own microphone. */
  localStream: StreamLike | null
  micOn: boolean
  /** Call only: our audio couldn't reach the helmet. */
  outgoingFailed: boolean
  /** When the picture first arrived, for the call timer. */
  liveSince: number | null
  /** Why it ended: hung up, or the app was left (a tablet can't keep a call in the background). */
  endReason: 'you' | 'left-app' | null
}

export interface LiveStart {
  /** false: helmet offline. Not queued: the command is dropped. */
  delivered: boolean
  /** WebRTC play endpoint on the media server. */
  watchUrl: string
  /** Someone is already watching; this viewer joins their stream. */
  alreadyLive?: boolean
}

export interface CallStart extends LiveStart {
  /** WebRTC push endpoint the helmet plays our microphone from. */
  adminPushUrl: string
}
