import { isSos, type Alarm } from '@/modules/alarms/types'

export const SOS_CALL_WINDOW_MS = 30 * 60_000

export type CallAccess =
  | { allowed: true; basis: 'sos'; alarmId: string }
  | { allowed: true; basis: 'permission' }
  | { allowed: false }

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
