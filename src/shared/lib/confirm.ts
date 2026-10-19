import { Alert, Platform } from 'react-native'

/**
 * A yes/no prompt that works everywhere. Alert.alert does nothing on web, so
 * the browser's own confirm() stands in for the `expo start --web` preview.
 */
export function confirmAction(opts: {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
}): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${opts.title}\n\n${opts.message}`)) opts.onConfirm()
    return
  }
  Alert.alert(opts.title, opts.message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: opts.confirmLabel,
      style: opts.destructive ? 'destructive' : 'default',
      onPress: opts.onConfirm,
    },
  ])
}
