/** GET/PUT /api/settings/site-wifi. The password is never returned, only whether one is set. */
export interface SiteWifi {
  ssid: string
  passwordSet: boolean
}

export interface SiteWifiInput {
  ssid: string
  /** Leave out to keep the current password. */
  password?: string
}

/**
 * The part of a helmet's Unit Setting this app edits so far. The backend stores more (upload
 * method, picture quality, temperatures, hat-off and no-movement times, alarm sounds), but its
 * field names aren't documented yet, so they're neither shown nor sent.
 */
export interface UnitSettings {
  videoSplitting?: boolean
  /** Whole minutes, 1-60. */
  videoSplitMinutes?: number
}

/** The answer to PUT /api/devices/{id}/settings. */
export interface SaveSettingsResult {
  saved: boolean
  /** True when the helmet was reachable and has been sent the settings. */
  delivered: boolean
  /** Settings reach the helmet now but only apply after it restarts. */
  appliesAfterRestart: boolean
  settings: UnitSettings
}

/** The answer to switching a helmet's network. `delivered` is false if the helmet couldn't be reached. */
export interface NetworkSwitchResult {
  delivered: boolean
}

/** The lengths offered for video splitting (the backend accepts any whole minute from 1 to 60). */
export const SPLIT_CHOICES = [10, 20, 30] as const
