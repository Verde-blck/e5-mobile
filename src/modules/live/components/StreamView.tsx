import { useEffect } from 'react'
import { RTCView, type MediaStream } from 'react-native-webrtc'
import type { StreamLike } from '../types'

/**
 * A picture from a stream, on the tablet. The helmet's sound plays by itself through the speaker; `muted` switches
 * the audio track off rather than the view, because that is what the stream's sound actually comes from. `overlay` is
 * for a small self-view over the main picture (it has to sit above it), and `mirrored` is the way a mirror shows you.
 */
export function StreamView({ stream, muted, mirrored = false, overlay = false }: { stream: StreamLike | null; muted: boolean; mirrored?: boolean; overlay?: boolean }) {
  useEffect(() => {
    // A self-view shows our own stream, whose audio track is our microphone: it must never be touched here, or
    // showing the picture would mute the person speaking.
    if (overlay) return
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
  }, [stream, muted, overlay])

  const url = stream ? (stream as unknown as MediaStream).toURL() : null
  if (!url) return null
  return <RTCView streamURL={url} objectFit={overlay ? 'cover' : 'contain'} mirror={mirrored} zOrder={overlay ? 1 : 0} style={{ flex: 1 }} />
}
