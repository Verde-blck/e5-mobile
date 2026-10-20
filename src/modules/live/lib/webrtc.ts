import { MediaStream, RTCPeerConnection, RTCSessionDescription, type MediaStreamTrack } from 'react-native-webrtc'
import type { StreamLike } from '../types'
import { MOCK_URL_PREFIX, SessionEndedError, exchange, type MediaConnection, type PeerLike } from './signalling'

// The tablet's WebRTC, on react-native-webrtc. (The browser preview has webrtc.web.ts.) The exchange with the
// media server is the shared one in signalling.ts.

const peerOf = (pc: RTCPeerConnection): PeerLike => ({
  createOffer: () => pc.createOffer({}) as Promise<{ sdp?: string }>,
  setLocalDescription: (description) => pc.setLocalDescription(description as never),
  setRemoteDescription: (description) => pc.setRemoteDescription(new RTCSessionDescription(description)),
})

function wrap(pc: RTCPeerConnection, stream: StreamLike): MediaConnection {
  let lost: (() => void) | null = null
  let fired = false
  pc.addEventListener('connectionstatechange', () => {
    // 'disconnected' often recovers by itself within seconds; 'failed' won't.
    if (pc.connectionState === 'failed' && !fired) {
      fired = true
      lost?.()
    }
  })
  return { stream, close: () => pc.close(), onLost: (callback) => { lost = callback } }
}

const nothing = (): MediaConnection => ({ stream: new MediaStream() as unknown as StreamLike, close: () => {}, onLost: () => {} })

/** Receives the helmet's camera and microphone. One attempt; see connectWithRetry. */
export async function play(watchUrl: string, signal: AbortSignal): Promise<MediaConnection> {
  if (watchUrl.startsWith(MOCK_URL_PREFIX)) {
    await new Promise((resolve) => setTimeout(resolve, 1_500))
    if (signal.aborted) throw new SessionEndedError()
    return nothing() // sample data on a tablet: connected, with no picture to show
  }

  const pc = new RTCPeerConnection()
  try {
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })

    // The remote stream arrives with the first track. react-native-webrtc hands over a ready-made stream there;
    // that is the one the video view must be given, so it is waited for (briefly) rather than assumed.
    let remote: MediaStream | null = null
    const own = new MediaStream()
    pc.addEventListener('track', (event) => {
      if (event.streams?.[0]) remote = event.streams[0]
      else own.addTrack(event.track as MediaStreamTrack)
    })
    await exchange(watchUrl, peerOf(pc), signal)
    for (let waited = 0; !remote && own.getTracks().length === 0 && waited < 3_000 && !signal.aborted; waited += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return wrap(pc, (remote ?? own) as unknown as StreamLike)
  } catch (error) {
    pc.close()
    throw error
  }
}

/** Sends the operator's own microphone, for the helmet to play. */
export async function push(pushUrl: string, media: StreamLike, signal: AbortSignal): Promise<MediaConnection> {
  if (pushUrl.startsWith(MOCK_URL_PREFIX)) return nothing()

  const pc = new RTCPeerConnection()
  try {
    media.getTracks().forEach((track) => pc.addTransceiver(track as unknown as MediaStreamTrack, { direction: 'sendonly' }))
    await exchange(pushUrl, peerOf(pc), signal)
    return wrap(pc, new MediaStream() as unknown as StreamLike)
  } catch (error) {
    pc.close()
    throw error
  }
}
