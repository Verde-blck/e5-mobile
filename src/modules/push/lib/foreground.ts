import { alarmTypeFromCode, severityForType } from '@/modules/alarms/types'
import type { PushMessage } from '../types'

// The backend marks more alarms critical than the app does (it also sends danger-level gas alarms to the siren
// channel), so for those the app alone would only chime and the system notification must still show.
export function appCoversAlarm(message: PushMessage | null): boolean {
  if (!message) return false
  if (message.kind === 'alarm-resolved') return true
  if (message.severity !== 'critical') return true
  return severityForType(alarmTypeFromCode(message.alarmType ?? '')) === 'critical'
}

// While the alarm stream is connected the app already shows its banner and plays its siren, so a second
// notification would double up, but only if the app really covers this alarm (see appCoversAlarm).
export function shouldShowInForeground(state: { appActive: boolean; streamOpen: boolean; appCoversAlarm: boolean }): boolean {
  return !(state.appActive && state.streamOpen && state.appCoversAlarm)
}
