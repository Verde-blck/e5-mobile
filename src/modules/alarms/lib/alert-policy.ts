import type { Alarm } from '../types'

// The backend only lets someone join an SOS call while the alarm is open and under 30 minutes old, so
// that is also how long an unresolved critical alarm keeps its box up and the siren eligible.
export const ALERT_WINDOW_MS = 30 * 60_000

// Alarms older than this when they arrive aren't news: on reconnect the server
// replays up to 50 missed alarms, and the phone shouldn't chime for each of them.
export const FRESH_MS = 2 * 60_000

export function criticalActive(alarms: readonly Alarm[], now: number): Alarm[] {
  return alarms
    .filter(
      (a) => a.status === 'active' && a.severity === 'critical' && now - a.raisedAt < ALERT_WINDOW_MS
    )
    .sort((a, b) => b.raisedAt - a.raisedAt)
}

// Critical alarms get a box in the middle of the screen that stays until someone acts; the rest get a small banner at the top.
export type Popup = 'modal' | 'banner'

export function popupFor(alarm: Pick<Alarm, 'severity'>): Popup {
  return alarm.severity === 'critical' ? 'modal' : 'banner'
}

// The critical alarms nobody has acted on yet, newest first. Acting on one (a button on the box, or opening the alarm) marks it handled,
// so the next waits its turn instead of being hidden behind the first, and the siren runs for as long as any is waiting.
export function awaitingAction(alarms: readonly Alarm[], handled: Readonly<Record<string, true>>, now: number): Alarm[] {
  return criticalActive(alarms, now).filter((a) => !handled[a.id])
}

// Critical ones are handled by the box and siren, which follow the live list, so
// there's nothing extra to do on arrival; the rest get a single chime and a banner.
export type ArrivalAlert = 'chime' | 'none'

export function arrivalAlert(alarm: Alarm, now: number): ArrivalAlert {
  if (alarm.status !== 'active') return 'none'
  if (now - alarm.raisedAt > FRESH_MS) return 'none'
  return alarm.severity === 'critical' ? 'none' : 'chime'
}
