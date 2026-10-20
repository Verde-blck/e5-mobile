import { mediaDevices } from 'react-native-webrtc'
import type { StreamLike } from '../types'

/**
 * The tablet's microphone, for talking to the helmet's wearer. Only the microphone: the tablet shows the helmet's
 * camera and never uses its own, so there is no camera permission in the app. Android asks the person for the
 * microphone the first time; a refusal rejects, and the session reports it before the helmet is touched.
 */
export async function getLocalMedia(): Promise<StreamLike> {
  return (await mediaDevices.getUserMedia({ audio: true, video: false })) as unknown as StreamLike
}
