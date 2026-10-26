import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio'
import { extensionFor, toWavFile } from '../lib/webAudio'

export interface RecordedAudio {
  uri: string
  name: string
  mimeType: string
  size?: number
  file?: Blob
}

// Built from the date's parts rather than a character-class regex: Tailwind scans all source text, comments
// included, and a bracketed pattern with a colon reads as an arbitrary property, which breaks the native build.
function stamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

// Recording stops itself at the limit, and leaving the screen stops it too, so the microphone is never left open.
export function useRecorder({ maxSeconds, namePrefix, onFinished }: { maxSeconds: number; namePrefix: string; onFinished: (audio: RecordedAudio) => void }) {
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
    const base = `${namePrefix}-${stamp(new Date())}`
    if (Platform.OS !== 'web') {
      onFinished({ uri, name: `${base}.m4a`, mimeType: 'audio/mp4' })
      return
    }
    // Send WAV, as the web dashboard does; if the browser can't convert it, send what it
    // is, honestly labelled, so the server's own answer says why it was refused.
    const raw = await (await fetch(uri)).blob()
    const wav = await toWavFile(raw, `${base}.wav`)
    const file = wav ?? new File([raw], `${base}.${extensionFor(raw.type)}`, { type: raw.type || 'application/octet-stream' })
    onFinished({ uri: URL.createObjectURL(file), name: file.name, mimeType: file.type, size: file.size, file })
  }, [namePrefix, onFinished, recorder, release])

  const start = useCallback(async () => {
    setError(null)
    const permission = await AudioModule.requestRecordingPermissionsAsync()
    if (!permission.granted) {
      setError("The microphone is blocked. Allow it in the tablet's settings to record.")
      return
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      live.current = true
      recorder.record({ forDuration: maxSeconds })
      setActive(true)
      timer.current = setTimeout(() => void stop(), (maxSeconds + 1) * 1000)
    } catch {
      live.current = false
      setError("Couldn't start recording. Try again.")
    }
  }, [maxSeconds, recorder, stop])

  const cancel = useCallback(async () => {
    await release()
  }, [release])

  useEffect(
    () => () => {
      if (live.current) void release()
    },
    [release]
  )

  // Tabs stay mounted when you switch to another one, so leaving the screen must also stop the recording.
  useFocusEffect(
    useCallback(
      () => () => {
        if (live.current) void release()
      },
      [release]
    )
  )

  return { active, seconds: Math.min(maxSeconds, Math.floor((state.durationMillis ?? 0) / 1000)), error, start, stop, cancel }
}
