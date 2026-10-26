import { mediaDevices } from 'react-native-webrtc'
import type { StreamLike } from '../types'

// A tablet with no camera carries on as an audio call rather than failing, and says so.
export async function getLocalMedia(withCamera: boolean): Promise<{ stream: StreamLike; noCamera: boolean }> {
  try {
    const stream = await mediaDevices.getUserMedia({ audio: true, video: withCamera ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 }, facingMode: 'user' } : false })
    return { stream: stream as unknown as StreamLike, noCamera: false }
  } catch (error) {
    const name = (error as { name?: string })?.name
    if (withCamera && (name === 'NotFoundError' || name === 'OverconstrainedError')) {
      const stream = await mediaDevices.getUserMedia({ audio: true, video: false })
      return { stream: stream as unknown as StreamLike, noCamera: true }
    }
    throw error
  }
}
