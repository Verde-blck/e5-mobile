/*
 * 16-bit mono WAV, the same encoding the web dashboard uses for voice messages: 16 kHz is plenty for speech and keeps a
 * minute of audio near 2 MB, well inside the backend's 10 MB limit. Pure functions, so they run (and are tested) anywhere.
 */
export const TARGET_SAMPLE_RATE = 16_000

/** Mixes any number of channels down to one by averaging them. */
export function downmix(channels: readonly Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]
  const length = channels[0]?.length ?? 0
  const mixed = new Float32Array(length)
  for (const data of channels) for (let i = 0; i < length; i += 1) mixed[i] += data[i] / channels.length
  return mixed
}

/** Linear resampling: good enough for speech. */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const length = Math.floor(input.length / ratio)
  const output = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio
    const lower = Math.floor(position)
    const upper = Math.min(lower + 1, input.length - 1)
    const weight = position - lower
    output[i] = input[lower] * (1 - weight) + input[upper] * weight
  }
  return output
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i))
}

/** The bytes of a 16-bit PCM mono WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(bytes)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header size
  view.setUint16(20, 1, true) // format: PCM
  view.setUint16(22, 1, true) // channels: mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }
  return new Uint8Array(bytes)
}
