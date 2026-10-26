export interface SiteWifi {
  ssid: string
  passwordSet: boolean
}

export interface SiteWifiInput {
  ssid: string
  password?: string
}

// The backend stores more (upload method, picture quality, temperatures, hat-off and no-movement times,
// alarm sounds), but its field names aren't documented yet, so they are neither shown nor sent.
export interface UnitSettings {
  videoSplitting?: boolean
  videoSplitMinutes?: number
}

export interface SaveSettingsResult {
  saved: boolean
  delivered: boolean
  appliesAfterRestart: boolean
  settings: UnitSettings
}

export interface NetworkSwitchResult {
  delivered: boolean
}

export const SPLIT_CHOICES = [10, 20, 30] as const
