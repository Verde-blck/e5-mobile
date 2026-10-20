import { alarmTypeFromCode, severityForType } from '@/modules/alarms/types'
import type { PushMessage } from '../types'

/**
 * Whether the app, with its own alarm connection open, will already warn the person AS LOUDLY as this
 * push would. The backend marks an alarm critical for more than the app does (it also sends gas alarms
 * at danger level to the siren channel); for one of those the app alone would only chime, so the system
 * notification has to show or the person would hear nothing.
 */
export function appCoversAlarm(message: PushMessage | null): boolean {
  if (!message) return false // not recognisable: better a notification too many than none
  if (message.kind === 'alarm-resolved') return true // nothing to show or sound
  if (message.severity !== 'critical') return true // the app's own banner or toast covers it
  return severityForType(alarmTypeFromCode(message.alarmType ?? '')) === 'critical'
}

/**
 * Whether the system should also show a notification while the app is on screen. When the alarm stream
 * is connected the app already shows its banner and plays its siren, so a second notification would just
 * double up, but only if the app really covers THIS alarm (see appCoversAlarm). When the stream has
 * dropped, the notification is the only warning, so it shows.
 */
export function shouldShowInForeground(state: { appActive: boolean; streamOpen: boolean; appCoversAlarm: boolean }): boolean {
  return !(state.appActive && state.streamOpen && state.appCoversAlarm)
}
