import { useRecorder } from '@/shared/hooks/useRecorder'
import type { ClipFile } from '../lib/clip'

/** A warning is a short sentence, not a speech; this also keeps the file far under the 5 MB limit. */
export const MAX_RECORDING_SECONDS = 30

/** Records a fence warning clip: an .m4a, which the backend converts to MP3 for the helmet. */
export function useClipRecorder(onFinished: (clip: ClipFile) => void) {
  return useRecorder({ maxSeconds: MAX_RECORDING_SECONDS, namePrefix: 'warning', onFinished })
}
