import { useEffect } from 'react'
import { RTCView, type MediaStream } from 'react-native-webrtc'
import type { StreamLike } from '../types'

/**
 * The helmet's picture, on the tablet. Its sound plays by itself through the speaker; `muted` switches the audio
 * track off rather than the view, because that is what the stream's sound actually comes from.
 */
export function StreamView({ stream, muted }: { stream: StreamLike | null; muted: boolean }) {
  useEffect(() => {
    stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted
    })
  }, [stream, muted])

  const url = stream ? (stream as unknown as MediaStream).toURL() : null
  if (!url) return null
  return <RTCView streamURL={url} objectFit="contain" style={{ flex: 1 }} />
}
