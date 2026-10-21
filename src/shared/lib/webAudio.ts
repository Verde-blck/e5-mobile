import { TARGET_SAMPLE_RATE, downmix, encodeWav, resample } from './wav'

/** A file extension for what a browser's recorder really produced, so it is never mislabelled. */
export function extensionFor(mimeType: string): string {
  const type = mimeType.toLowerCase()
  if (type.includes('webm')) return 'webm'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) return 'm4a'
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3'
  if (type.includes('wav')) return 'wav'
  return 'bin'
}

/**
 * A browser records WebM/Opus (Safari, MP4), which the helmets can't play and the backend doesn't take. This turns it
 * into the 16 kHz mono WAV the web dashboard sends. Returns null if the browser can't decode it, so the caller can send
 * the recording as it is and let the server's own answer say why it was refused.
 */
export async function toWavFile(blob: Blob, name: string): Promise<File | null> {
  const Context = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Context) return null
  const context = new Context()
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i))
    const samples = resample(downmix(channels), decoded.sampleRate, TARGET_SAMPLE_RATE)
    return new File([encodeWav(samples, TARGET_SAMPLE_RATE) as BlobPart], name, { type: 'audio/wav' })
  } catch {
    return null
  } finally {
    void context.close()
  }
}
