import { useEffect, useState } from 'react'
import type { StreamLike } from '../types'

// Tracks arrive one at a time over WebRTC, so the answer can change after the stream appears. The stream gives no change event on
// every platform here, so it is simply looked at once a second.
export function useStreamHasAudio(stream: StreamLike | null): boolean {
  const [hasAudio, setHasAudio] = useState(false)
  useEffect(() => {
    if (!stream) {
      setHasAudio(false)
      return
    }
    const check = () => setHasAudio(stream.getAudioTracks().length > 0)
    check()
    const timer = setInterval(check, 1000)
    return () => clearInterval(timer)
  }, [stream])
  return hasAudio
}
