import { Alert, Linking } from 'react-native'
import { env } from '@/config/env'

// Google Play requires the policy to be reachable from inside the app as well as from the store page.
export function openPrivacyPolicy(): void {
  const url = env.privacyPolicyUrl
  // If the tablet has no browser to open it, show the address so it can still be read.
  Linking.openURL(url).catch(() => Alert.alert('Privacy policy', `Open this address in a browser:\n${url}`))
}
