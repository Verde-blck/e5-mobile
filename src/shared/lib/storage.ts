import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

/**
 * Small key/value store for the token and a few flags.
 *
 * On a phone this is the Keychain (iOS) / Keystore-backed storage (Android),
 * which is the right place for a bearer token — unlike the web dashboard's
 * localStorage, it isn't readable by other apps or by injected script.
 *
 * expo-secure-store has no web implementation, so `expo start --web` (handy
 * for a quick layout check) falls back to localStorage. Real builds never
 * take that branch.
 */
const isWeb = Platform.OS === 'web'

/** SecureStore keys may only contain letters, digits, '.', '-' and '_'. */
export function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_')
}

export const storage = {
  async get(key: string): Promise<string | null> {
    const k = safeKey(key)
    try {
      return isWeb ? localStorage.getItem(k) : await SecureStore.getItemAsync(k)
    } catch {
      return null
    }
  },

  async set(key: string, value: string): Promise<void> {
    const k = safeKey(key)
    if (isWeb) localStorage.setItem(k, value)
    else await SecureStore.setItemAsync(k, value)
  },

  async remove(key: string): Promise<void> {
    const k = safeKey(key)
    try {
      if (isWeb) localStorage.removeItem(k)
      else await SecureStore.deleteItemAsync(k)
    } catch {
      // Nothing to delete, or the keystore is unavailable. Either way the
      // in-memory copy has already been cleared by the caller.
    }
  },
}
