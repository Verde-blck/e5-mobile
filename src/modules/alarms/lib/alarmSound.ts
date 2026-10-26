import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

// sos.wav and chime.wav are generated tones: replace them in assets/sounds with E5's own recordings. Every call is
// wrapped so a sound failure can never take the alert UI with it: the banner is the alert, the sound is the extra.

let siren: AudioPlayer | null = null
let chime: AudioPlayer | null = null
let modeReady = false

async function prepare(): Promise<void> {
  if (modeReady) return
  // Foreground only: a locked phone, or one in another app, can't be reached this way. That needs push notifications.
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    allowsRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  })
  modeReady = true
}

export async function startSiren(): Promise<void> {
  try {
    await prepare()
    siren ??= createAudioPlayer(require('../../../../assets/sounds/sos.wav'))
    siren.loop = true
    siren.volume = 1
    siren.play()
  } catch {
    // Silent failure is acceptable here; see the note at the top.
  }
}

export function stopSiren(): void {
  try {
    siren?.pause()
    void siren?.seekTo(0)
  } catch {
    // ignore
  }
}

export async function playChime(): Promise<void> {
  try {
    await prepare()
    chime ??= createAudioPlayer(require('../../../../assets/sounds/chime.wav'))
    chime.volume = 1
    await chime.seekTo(0)
    chime.play()
  } catch {
    // ignore
  }
}
