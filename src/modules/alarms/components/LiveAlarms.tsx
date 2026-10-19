import { useEffect, useState } from 'react'
import { AppState, Vibration } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { env } from '@/config/env'
import { useAuthStore } from '@/shared/store/authStore'
import { toAlarm } from '../api/alarms.api'
import { subscribeMockStream } from '../api/alarms.mock'
import type { ApiAlarm } from '../api/alarms.wire'
import { useCriticalAlarms } from '../hooks/useAlarms'
import { applyAlarm } from '../lib/alarm-cache'
import { arrivalAlert } from '../lib/alert-policy'
import { connectAlarmStream, streamStatus } from '../lib/alarmStream'
import { playChime, startSiren, stopSiren } from '../lib/alarmSound'
import { useAlertStore } from '../store/alertStore'

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'))
    return () => sub.remove()
  }, [])
  return active
}

/**
 * The engine behind the alarm alerts. Renders nothing; it keeps three things
 * running while someone is signed in:
 *
 *  1. The live alarm stream, written straight into the alarm list's cache, so
 *     an alarm shows up the instant the backend saves it.
 *  2. A chime and toast for fresh non-critical alarms.
 *  3. The siren and vibration, for as long as any critical alarm is
 *     unresolved and not yet silenced.
 *
 * The stream is held open only while the app is in the foreground. A phone
 * that's locked or in another app doesn't get alarms this way — that is what
 * push notifications are for, and they need backend support.
 */
export function LiveAlarms() {
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const appActive = useAppActive()

  // 1 + 2: the stream
  useEffect(() => {
    if (!isAuthenticated || !appActive) return

    const handleAlarm = (raw: ApiAlarm) => {
      const alarm = toAlarm(raw)
      applyAlarm(queryClient, alarm)
      // The dashboard's "alarms in 24 h" count changes with every new alarm.
      void queryClient.invalidateQueries({ queryKey: ['fleet-summary'] })
      if (arrivalAlert(alarm, Date.now()) === 'chime') {
        void playChime()
        useAlertStore.getState().showToast(alarm)
      }
    }
    // Resolved or reopened somewhere. The banner and siren follow the list,
    // so updating it is all that's needed to clear them on this phone too.
    const handleUpdate = (raw: ApiAlarm) => applyAlarm(queryClient, toAlarm(raw))

    if (env.useMocks) {
      streamStatus.set('open')
      const off = subscribeMockStream(handleAlarm, handleUpdate)
      return () => {
        off()
        streamStatus.set('down')
      }
    }

    const connection = connectAlarmStream({ onAlarm: handleAlarm, onUpdate: handleUpdate })
    return () => connection.stop()
  }, [isAuthenticated, appActive, queryClient])

  // 3: siren + vibration
  const critical = useCriticalAlarms()
  const silenced = useAlertStore((s) => s.silenced)
  const ringing = critical.some((a) => !silenced[a.id])

  useEffect(() => {
    if (!ringing) return
    void startSiren()
    Vibration.vibrate(500)
    // A repeating pattern is Android-only; an interval behaves the same everywhere.
    const buzz = setInterval(() => Vibration.vibrate(500), 1500)
    return () => {
      clearInterval(buzz)
      Vibration.cancel()
      stopSiren()
    }
  }, [ringing])

  return null
}
