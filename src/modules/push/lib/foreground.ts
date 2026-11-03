import { alarmTypeFromCode, severityForType } from '@/modules/alarms/types'
import type { PushMessage } from '../types'

// The backend can call an alarm critical that the app has no name for yet (a code it doesn't recognise), and for
// that the app alone would only chime, so the system notification must still show.
export function appCoversAlarm(message: PushMessage | null): boolean {
  if (!message) return false
  if (message.kind === 'alarm-resolved') return true
  if (message.severity !== 'critical') return true
  return severityForType(alarmTypeFromCode(message.alarmType ?? '')) === 'critical'
}

// While the alarm stream is connected the app already shows its box and plays its siren, so a second
// notification would double up, but only if the app really covers this alarm (see appCoversAlarm).
export function shouldShowInForeground(state: { appActive: boolean; streamOpen: boolean; appCoversAlarm: boolean }): boolean {
  return !(state.appActive && state.streamOpen && state.appCoversAlarm)
}
