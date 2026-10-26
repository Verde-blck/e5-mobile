import { Platform, Share } from 'react-native'

export async function exportCsv(filename: string, csv: string): Promise<'downloaded' | 'shared' | 'cancelled'> {
  if (Platform.OS === 'web') {
    // Byte-order mark so Excel reads it as UTF-8 rather than mangling accents.
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    return 'downloaded'
  }
  const result = await Share.share({ title: filename, message: csv })
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared'
}
