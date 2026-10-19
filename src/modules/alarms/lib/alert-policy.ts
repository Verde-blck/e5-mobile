import type { Alarm } from '../types'

/**
 * How the app reacts to alarms, in one place so it can be tuned in one place.
 *
 * Cypher's guidance (16 Oct): critical alarms (SOS 7, SOS button, fall 4,
 * near-electricity 11, no-movement 6) get a loud repeating ringtone until
 * someone opens or acknowledges them, plus a red banner on every screen;
 * everything else gets a short alert once. "Critical" is `severity`, derived
 * in alarms/types.ts from exactly that set.
 */

/**
 * The backend only lets someone join an SOS call while the alarm is open and
 * under 30 minutes old, so that is also how long an unresolved critical alarm
 * keeps the banner up and the siren eligible. After that it's still in the
 * list, just no longer shouting.
 */
export const ALERT_WINDOW_MS = 30 * 60_000

/**
 * Alarms older than this when they arrive aren't news. This matters on
 * reconnect: the server replays up to 50 missed alarms, and the phone
 * shouldn't chime for each of them.
 */
export const FRESH_MS = 2 * 60_000

/** Unresolved critical alarms still inside the alert window, newest first. */
export function criticalActive(alarms: readonly Alarm[], now: number): Alarm[] {
  return alarms
    .filter(
      (a) => a.status === 'active' && a.severity === 'critical' && now - a.raisedAt < ALERT_WINDOW_MS
    )
    .sort((a, b) => b.raisedAt - a.raisedAt)
}

/**
 * What to do the moment an alarm arrives on the stream. Critical ones are
 * handled by the banner and siren, which follow the live list, so there's
 * nothing extra to do on arrival; the rest get a single chime and a toast.
 */
export type ArrivalAlert = 'chime' | 'none'

export function arrivalAlert(alarm: Alarm, now: number): ArrivalAlert {
  if (alarm.status !== 'active') return 'none'
  if (now - alarm.raisedAt > FRESH_MS) return 'none'
  return alarm.severity === 'critical' ? 'none' : 'chime'
}
