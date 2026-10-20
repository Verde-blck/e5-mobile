import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio'
import type { ClipFile } from '../lib/clip'

// Built from the date's parts rather than a character-class regex: Tailwind scans all source text (comments
// included) for class names, and a bracketed pattern with a colon reads as an "arbitrary property", which
// breaks the native style compiler. See tests/build.test.ts.
function stamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/** A warning is a short sentence, not a speech; this also keeps the file far under the 5 MB limit. */
export const MAX_RECORDING_SECONDS = 30

/**
 * Records a warning clip on the tablet. A tablet records AAC in an .m4a file, which the backend accepts
 * and converts to MP3 for the helmet. Recording stops itself at the limit, and leaving the screen stops
 * it too, so the microphone is never left open.
 */
export function useClipRecorder(onFinished: (clip: ClipFile) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const state = useAudioRecorderState(recorder, 250)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const live = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const release = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    live.current = false
    setActive(false)
    try {
      await recorder.stop()
    } catch {
      /* it had already stopped */
    }
    // Hand the audio session back, so playback elsewhere in the app behaves normally.
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {})
  }, [recorder])

  const stop = useCallback(async () => {
    if (!live.current) return
    await release()
    const uri = recorder.uri
    if (!uri) {
      setError("That recording didn't save. Try again.")
      return
    }
    onFinished({ uri, name: `warning-${stamp(new Date())}.m4a`, mimeType: 'audio/mp4' })
  }, [onFinished, recorder, release])

  const start = useCallback(async () => {
    setError(null)
    const permission = await AudioModule.requestRecordingPermissionsAsync()
    if (!permission.granted) {
      setError("The microphone is blocked. Allow it in the tablet's settings to record a clip.")
      return
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      live.current = true
      recorder.record({ forDuration: MAX_RECORDING_SECONDS })
      setActive(true)
      // The recorder stops itself at the limit; this collects the result when it does.
      timer.current = setTimeout(() => void stop(), (MAX_RECORDING_SECONDS + 1) * 1000)
    } catch {
      live.current = false
      setError("Couldn't start recording. Try again.")
    }
  }, [recorder, stop])

  const cancel = useCallback(async () => {
    await release()
  }, [release])

  useEffect(
    () => () => {
      if (live.current) void release()
    },
    [release]
  )

  return { active, seconds: Math.min(MAX_RECORDING_SECONDS, Math.floor((state.durationMillis ?? 0) / 1000)), error, start, stop, cancel }
}
