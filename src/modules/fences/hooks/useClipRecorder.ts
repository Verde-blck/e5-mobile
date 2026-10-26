import { useRecorder } from '@/shared/hooks/useRecorder'
import type { ClipFile } from '../lib/clip'

export const MAX_RECORDING_SECONDS = 30

export function useClipRecorder(onFinished: (clip: ClipFile) => void) {
  return useRecorder({ maxSeconds: MAX_RECORDING_SECONDS, namePrefix: 'warning', onFinished })
}
