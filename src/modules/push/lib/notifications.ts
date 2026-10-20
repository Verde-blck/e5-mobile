import { AppState, Linking, Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { streamStatus } from '@/modules/alarms/lib/alarmStream'
import type { PermissionState, PushAdapter } from './adapter'
import { CHANNELS, SOS_CHANNEL } from './channels'
import { shouldShowInForeground } from './foreground'
import { parsePushData } from './payload'

const IMPORTANCE = {
  max: Notifications.AndroidImportance.MAX,
  high: Notifications.AndroidImportance.HIGH,
} as const

let configured = false

/** The Android tablet implementation, on expo-notifications and the device's own FCM token. */
export const notifications: PushAdapter = {
  isSupported: () => Platform.OS === 'android',

  async setup() {
    if (configured) return
    configured = true

    Notifications.setNotificationHandler({
      handleNotification: async () => {
        const show = shouldShowInForeground({
          appActive: AppState.currentState === 'active',
          streamOpen: streamStatus.get() === 'open',
        })
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false }
      },
    })

    for (const channel of CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: IMPORTANCE[channel.importance],
        sound: channel.sound,
        vibrationPattern: channel.vibrationPattern,
        enableVibrate: true,
        enableLights: true,
        lightColor: channel.lightColor,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: channel.bypassDnd,
        audioAttributes: {
          usage: channel.alarmVolume
            ? Notifications.AndroidAudioUsage.ALARM
            : Notifications.AndroidAudioUsage.NOTIFICATION,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      })
    }
  },

  async permission(): Promise<PermissionState> {
    const result = await Notifications.getPermissionsAsync()
    if (result.granted) return 'granted'
    // Android lets the app ask once more after a first refusal; after that only Settings can help.
    return result.canAskAgain ? 'undetermined' : 'denied'
  },

  async requestPermission(): Promise<PermissionState> {
    const result = await Notifications.requestPermissionsAsync()
    return result.granted ? 'granted' : 'denied'
  },

  async getToken() {
    const token = await Notifications.getDevicePushTokenAsync()
    if (typeof token.data !== 'string' || !token.data) throw new Error('No push token')
    return token.data
  },

  onTokenChange(callback) {
    const subscription = Notifications.addPushTokenListener((token) => {
      if (typeof token.data === 'string' && token.data) callback(token.data)
    })
    return () => subscription.remove()
  },

  onReceive(callback) {
    const subscription = Notifications.addNotificationReceivedListener((n) => callback(n.request.content.data))
    return () => subscription.remove()
  },

  onTap(callback) {
    const subscription = Notifications.addNotificationResponseReceivedListener((r) =>
      callback(r.notification.request.content.data)
    )
    return () => subscription.remove()
  },

  initialTap() {
    return Notifications.getLastNotificationResponse()?.notification.request.content.data ?? null
  },

  async dismiss(alarmId) {
    const shown = await Notifications.getPresentedNotificationsAsync()
    await Promise.all(
      shown
        .filter((n) => parsePushData(n.request.content.data)?.alarmId === alarmId)
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
    )
  },

  async sendTest() {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test alert',
        body: 'If you heard the siren and can see this on the lock screen, alarms will reach this tablet.',
        data: { kind: 'test' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: SOS_CHANNEL,
      },
    })
  },

  async openSettings() {
    await Linking.openSettings()
  },

  async openBatterySettings() {
    try {
      await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS')
    } catch {
      await Linking.openSettings()
    }
  },
}
