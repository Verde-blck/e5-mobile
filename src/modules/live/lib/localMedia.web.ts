import type { StreamLike } from '../types'

/** The browser preview's microphone. */
export async function getLocalMedia(): Promise<StreamLike> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser can’t use the microphone here. It needs the page on https:// (or localhost).')
  }
  return (await navigator.mediaDevices.getUserMedia({ audio: true, video: false })) as unknown as StreamLike
}
