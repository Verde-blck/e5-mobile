// A short beep as a data: URI, for the sample conversation. A real build never uses it.
const RATE = 16_000
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63] + (i + 1 < bytes.length ? CHARS[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? CHARS[n & 63] : '=')
  }
  return out
}

/** 16-bit mono PCM WAV of a sine tone with soft edges. */
export function toneWavBytes(seconds = 0.6, frequency = 660): Uint8Array {
  const samples = Math.floor(RATE * seconds)
  const bytes = new Uint8Array(44 + samples * 2)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i += 1) {
    const fade = Math.min(1, Math.min(i, samples - i) / (RATE * 0.05))
    view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * frequency * i) / RATE) * 0.3 * fade * 0x7fff), true)
  }
  return bytes
}

export const toneDataUri = () => `data:audio/wav;base64,${base64(toneWavBytes())}`
