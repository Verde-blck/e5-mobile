import { useEffect } from 'react'
import { AppState } from 'react-native'
import Constants from 'expo-constants'
import { env } from '@/config/env'
import { queryClient } from '@/shared/lib/query-client'
import { openAlarm } from '@/modules/alarms/components/AlarmCard'
import { ALARMS_KEY } from '@/modules/alarms/lib/alarm-cache'
import { registerPush } from '../api/push.api'
import { getInstallId } from '../lib/installId'
import { notifications } from '../lib/notifications'
import { parsePushData } from '../lib/payload'
import { syncPush } from '../lib/sync'
import { usePushStore } from '../store/pushStore'

const appVersion = Constants.expoConfig?.version ?? '0.0.0'
let running = false
let handledLaunchTap = false

/**
 * Brings this tablet's alarm alerts up to date. `ask` is true only when the person has pressed
 * "Turn on" (or Try again), so the system permission prompt never appears out of the blue.
 */
export async function runPushSetup(ask: boolean): Promise<void> {
  const { setStatus } = usePushStore.getState()
  if (!env.pushEnabled) {
    setStatus('off')
    return
  }
  if (running) return
  running = true
  try {
    if (ask) setStatus('registering')
    setStatus(
      await syncPush({ adapter: notifications, register: registerPush, installId: getInstallId, appVersion, ask })
    )
  } finally {
    running = false
  }
}

function refreshAlarms() {
  void queryClient.invalidateQueries({ queryKey: ALARMS_KEY })
}

/** A push that arrived (or was tapped) is acted on only if it parses as one of ours. */
function onPush(data: unknown, tapped: boolean) {
  const message = parsePushData(data)
  if (!message) return
  if (message.kind === 'alarm-resolved') {
    void notifications.dismiss(message.alarmId)
    refreshAlarms()
    return
  }
  refreshAlarms()
  if (tapped) openAlarm(message.alarmId)
}

/**
 * Mounted while signed in. Keeps alerts set up, re-registers when Google rotates the token, opens
 * the alarm when its notification is tapped (including the tap that launched the app), and
 * refreshes the alarm list when a push arrives.
 */
export function usePushSetup(): void {
  useEffect(() => {
    void runPushSetup(false)

    // Coming back from the tablet's settings after allowing notifications: pick it up.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active' && usePushStore.getState().status === 'blocked') void runPushSetup(false)
    })

    if (!env.pushEnabled) return () => appState.remove()

    const stopToken = notifications.onTokenChange(async (token) => {
      try {
        await registerPush({ installId: await getInstallId(), token, platform: 'android', appVersion })
      } catch {
        usePushStore.getState().setStatus('error')
      }
    })
    const stopReceive = notifications.onReceive((data) => onPush(data, false))
    const stopTap = notifications.onTap((data) => onPush(data, true))

    // The notification that launched the app, handled once per run, after navigation is ready.
    if (!handledLaunchTap) {
      handledLaunchTap = true
      const launch = notifications.initialTap()
      if (launch) setTimeout(() => onPush(launch, true), 400)
    }

    return () => {
      appState.remove()
      stopToken()
      stopReceive()
      stopTap()
    }
  }, [])
}
