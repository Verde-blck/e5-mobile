import * as DocumentPicker from 'expo-document-picker'
import { validateClip, type ClipFile } from './clip'

export async function pickClip(): Promise<{ clip: ClipFile } | { error: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // audio/* rather than only mp3/wav: some tablets don't list WAV files under their own type.
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
