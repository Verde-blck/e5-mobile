import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { env } from '@/config/env'
import { chooseMapEngine, type MapEngine } from './nativeMap'

/** Whether this build was made with a Google Maps key (app.config.js records that while building). */
export function buildHasGoogleMapsKey(): boolean {
  return (Constants.expoConfig?.extra as { googleMapsEnabled?: boolean } | undefined)?.googleMapsEnabled === true
}

/** Which map this build shows. */
export function currentMapEngine(): MapEngine {
  return chooseMapEngine({ platform: Platform.OS, hasKey: buildHasGoogleMapsKey(), preference: env.mapEngine })
}
