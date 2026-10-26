import type { StreamLike } from '../types'

export async function getLocalMedia(withCamera: boolean): Promise<{ stream: StreamLike; noCamera: boolean }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser can’t use the microphone here. It needs the page on https:// (or localhost).')
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withCamera ? { width: { ideal: 640 }, height: { ideal: 480 } } : false })
    return { stream: stream as unknown as StreamLike, noCamera: false }
  } catch (error) {
    const name = (error as DOMException)?.name
    if (withCamera && (name === 'NotFoundError' || name === 'OverconstrainedError')) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      return { stream: stream as unknown as StreamLike, noCamera: true }
    }
    throw error
  }
}
