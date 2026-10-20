import { isSos, type Alarm } from '@/modules/alarms/types'

/** How long after an SOS alarm anyone signed in may join its call (the backend's rule). */
export const SOS_CALL_WINDOW_MS = 30 * 60_000

export type CallAccess =
  | { allowed: true; basis: 'sos'; alarmId: string }
  | { allowed: true; basis: 'permission' }
  | { allowed: false }

/**
 * Whether this account may call this helmet, by the backend's rule (the tablet only decides what to
 * offer; the backend decides what is allowed):
 *  - anyone signed in may join a call for a helmet with an OPEN SOS alarm raised in the last 30 minutes;
 *  - any other call needs the live-view management permission (SURVEILLANCE_MANAGE, `live:write`).
 * An SOS wins when both hold, so the screen can say why the call is being made.
 */
export function callAccess({
  deviceId,
  alarms,
  canManage,
  now,
}: {
  deviceId: string
  alarms: readonly Alarm[]
  canManage: boolean
  now: number
}): CallAccess {
  const sos = alarms
    .filter((a) => a.deviceId === deviceId && a.status === 'active' && isSos(a.type) && now - a.raisedAt < SOS_CALL_WINDOW_MS && now >= a.raisedAt - 60_000)
    .sort((a, b) => b.raisedAt - a.raisedAt)[0]
  if (sos) return { allowed: true, basis: 'sos', alarmId: sos.id }
  return canManage ? { allowed: true, basis: 'permission' } : { allowed: false }
}
