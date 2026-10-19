import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

// Two sounds: a siren that loops for critical alarms, and a short chime for
// the rest. Both are placeholders generated for this project; swap in the
// client's own tones by replacing the files in assets/sounds.
//
// Every call is wrapped so a sound failure can never take the alert UI with
// it — the banner is the alert; the sound is the extra.

let siren: AudioPlayer | null = null
let chime: AudioPlayer | null = null
let modeReady = false

async function prepare(): Promise<void> {
  if (modeReady) return
  // An SOS has to be audible with the ringer switch off, which is the whole
  // point of it. Foreground only: a phone that's locked or in another app
  // can't be reached this way — that needs push notifications.
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
