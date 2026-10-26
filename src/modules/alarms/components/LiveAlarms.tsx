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

export function LiveAlarms() {
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const appActive = useAppActive()

  useEffect(() => {
    if (!isAuthenticated || !appActive) return

    const handleAlarm = (raw: ApiAlarm) => {
      const alarm = toAlarm(raw)
      applyAlarm(queryClient, alarm)
      void queryClient.invalidateQueries({ queryKey: ['fleet-summary'] })
      if (arrivalAlert(alarm, Date.now()) === 'chime') {
        void playChime()
        useAlertStore.getState().showToast(alarm)
      }
    }
    // The banner and siren follow the list, so updating it is all that's needed to clear them on this phone too.
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

  const critical = useCriticalAlarms()
  const silenced = useAlertStore((s) => s.silenced)
  const ringing = critical.some((a) => !silenced[a.id])

  useEffect(() => {
    if (!ringing) return
    void startSiren()
    Vibration.vibrate(500)
    const buzz = setInterval(() => Vibration.vibrate(500), 1500)
    return () => {
      clearInterval(buzz)
      Vibration.cancel()
      stopSiren()
    }
  }, [ringing])

  return null
}
