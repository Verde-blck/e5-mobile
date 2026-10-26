import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { env } from '@/config/env'
import { chooseMapEngine, type MapEngine } from './nativeMap'

export function buildHasGoogleMapsKey(): boolean {
  return (Constants.expoConfig?.extra as { googleMapsEnabled?: boolean } | undefined)?.googleMapsEnabled === true
}

export function currentMapEngine(): MapEngine {
  return chooseMapEngine({ platform: Platform.OS, hasKey: buildHasGoogleMapsKey(), preference: env.mapEngine })
}
