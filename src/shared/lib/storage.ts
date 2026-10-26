import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const isWeb = Platform.OS === 'web'

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
