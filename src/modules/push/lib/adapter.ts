/** What 'granted' means here: notifications may be shown. 'denied' means only the settings can change it. */
export type PermissionState = 'granted' | 'denied' | 'undetermined'

/**
 * The one seam between the app and the tablet's notification system. The Android implementation is
 * notifications.ts (expo-notifications); the browser preview uses notifications.web.ts, which
 * simulates it so the whole flow can be exercised without a device.
 */
export interface PushAdapter {
  isSupported(): boolean
  /** Creates the notification channels and the foreground behaviour. Safe to call repeatedly. */
  setup(): Promise<void>
  permission(): Promise<PermissionState>
  requestPermission(): Promise<PermissionState>
  /** The Expo push token. Throws when there is no EAS project id, or Google services / Firebase aren't available. */
  getToken(): Promise<string>
  onTokenChange(callback: (token: string) => void): () => void
  /** A push arrived while the app is open. */
  onReceive(callback: (data: unknown) => void): () => void
  /** The person tapped a notification. */
  onTap(callback: (data: unknown) => void): () => void
  /** The notification that launched the app, if one did. */
  initialTap(): unknown | null
  /** Remove any notification shown for this alarm. */
  dismiss(alarmId: string): Promise<void>
  /** A local test alert in the SOS channel, a few seconds from now. */
  sendTest(): Promise<void>
  openSettings(): Promise<void>
  openBatterySettings(): Promise<void>
}
