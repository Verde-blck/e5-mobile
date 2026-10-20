import * as DocumentPicker from 'expo-document-picker'
import { validateClip, type ClipFile } from './clip'

/**
 * Opens the tablet's file picker for an audio file. Resolves to the clip, an error message to show,
 * or null if the person backed out. The picker copies the file into the app's cache so it can be
 * uploaded from there.
 */
export async function pickClip(): Promise<{ clip: ClipFile } | { error: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // audio/* rather than only mp3/wav: some tablets don't list WAV files under their own type.
    // The choice is checked below instead.
    type: 'audio/*',
    copyToCacheDirectory: true,
    multiple: false,
  })
  if (result.canceled || !result.assets?.[0]) return null

  const asset = result.assets[0]
  const problem = validateClip({ name: asset.name, mimeType: asset.mimeType, size: asset.size })
  if (problem) return { error: problem }
  return {
    clip: { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? '', size: asset.size, file: asset.file },
  }
}
