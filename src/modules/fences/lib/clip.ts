/** The most the backend accepts for a warning clip. */
export const CLIP_MAX_BYTES = 5 * 1024 * 1024

/** A clip chosen on the tablet, ready to upload. `file` is set only in the browser preview. */
export interface ClipFile {
  uri: string
  name: string
  mimeType: string
  size?: number
  file?: Blob
}

// MP3 and WAV go to the helmet as they are; M4A, AAC and 3GP (what a tablet records) are converted to MP3 by the backend.
const EXTENSION = /\.(mp3|wav|m4a|aac|3gp)$/i
const MIME = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/3gpp']

/**
 * Why this file can't be a warning clip, or null if it can. The backend takes MP3, WAV, M4A, AAC or 3GP up to 5 MB;
 * telling the person here is quicker than uploading to be refused. (Either the name or the type is
 * enough: Android sometimes reports a WAV as audio/x-wav and sometimes not at all.)
 */
export function validateClip(file: { name: string; mimeType?: string | null; size?: number | null }): string | null {
  const typeOk = EXTENSION.test(file.name) || (!!file.mimeType && MIME.includes(file.mimeType.toLowerCase()))
  if (!typeOk) return 'Choose an MP3, WAV or M4A file.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size != null && file.size > CLIP_MAX_BYTES) return 'That clip is over 5 MB. Keep it to a short sentence.'
  return null
}

/** The type to upload it as: from the name when it has a known extension, so a vague picker type can't mislabel it. */
export type ClipMime = 'audio/mpeg' | 'audio/wav' | 'audio/mp4' | 'audio/aac' | 'audio/3gpp'
export function clipMimeType(name: string, reported?: string | null): ClipMime {
  if (/\.mp3$/i.test(name)) return 'audio/mpeg'
  if (/\.wav$/i.test(name)) return 'audio/wav'
  if (/\.m4a$/i.test(name)) return 'audio/mp4'
  if (/\.aac$/i.test(name)) return 'audio/aac'
  if (/\.3gp$/i.test(name)) return 'audio/3gpp'
  if (reported && /mp4|m4a/i.test(reported)) return 'audio/mp4'
  if (reported && /aac/i.test(reported)) return 'audio/aac'
  if (reported && /3gpp/i.test(reported)) return 'audio/3gpp'
  return reported && /mpeg|mp3/i.test(reported) ? 'audio/mpeg' : 'audio/wav'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
