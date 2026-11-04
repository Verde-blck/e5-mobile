import type { Alarm, AlarmSeverity } from '@/modules/alarms/types'
import type { DeviceView } from '../types'

/** The most serious open alarm of each helmet. */
export function worstOpenAlarms(alarms: readonly Pick<Alarm, 'deviceId' | 'status' | 'severity'>[]): Map<string, AlarmSeverity> {
  const worst = new Map<string, AlarmSeverity>()
  for (const a of alarms) {
    if (a.status !== 'active') continue
    if (worst.get(a.deviceId) !== 'critical') worst.set(a.deviceId, a.severity)
  }
  return worst
}

// The backend's helmet list carries no alarm state, so a helmet's active alarm comes from the open alarms.
export function withAlarmState(view: DeviceView, worst: ReadonlyMap<string, AlarmSeverity>): DeviceView {
  const fromAlarms = worst.get(view.id) ?? null
  const activeAlarm = view.activeAlarm === 'critical' || fromAlarms === 'critical' ? 'critical' : (fromAlarms ?? view.activeAlarm)
  return activeAlarm === view.activeAlarm ? view : { ...view, activeAlarm }
}
