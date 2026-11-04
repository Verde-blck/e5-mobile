import assert from 'node:assert/strict'
import { withAlarmState, worstOpenAlarms } from '@/modules/devices/lib/alarmState'
import type { DeviceView } from '@/modules/devices/types'
import type { Alarm } from '@/modules/alarms/types'
import { createRunner } from './harness'

const { t, report } = createRunner()
const alarm = (deviceId: string, severity: Alarm['severity'], status: Alarm['status'] = 'active') => ({ deviceId, severity, status })
const view = (id: string, activeAlarm: DeviceView['activeAlarm'] = null) => ({ id, name: id, activeAlarm }) as DeviceView

async function main() {
  await t('each helmet gets its worst open alarm, and a critical one outranks a warning whichever came first', () => {
    const worst = worstOpenAlarms([alarm('a', 'warning'), alarm('a', 'critical'), alarm('b', 'critical'), alarm('b', 'warning'), alarm('c', 'warning')])
    assert.deepEqual([...worst].sort(), [['a', 'critical'], ['b', 'critical'], ['c', 'warning']])
  })
  await t('a resolved alarm says nothing about a helmet, and a helmet with no alarms is not in the map', () => {
    const worst = worstOpenAlarms([alarm('a', 'critical', 'resolved'), alarm('b', 'warning')])
    assert.equal(worst.has('a'), false); assert.equal(worst.get('b'), 'warning'); assert.equal(worstOpenAlarms([]).size, 0)
  })
  await t('a helmet\'s view takes its alarm state from the open alarms, since the helmet list carries none', () => {
    const worst = worstOpenAlarms([alarm('a', 'critical'), alarm('b', 'warning')])
    assert.equal(withAlarmState(view('a'), worst).activeAlarm, 'critical'); assert.equal(withAlarmState(view('b'), worst).activeAlarm, 'warning'); assert.equal(withAlarmState(view('z'), worst).activeAlarm, null)
  })
  await t('a critical state already on the helmet is never lowered, and an untouched view is returned as it is', () => {
    const worst = worstOpenAlarms([alarm('a', 'warning')])
    assert.equal(withAlarmState(view('a', 'critical'), worst).activeAlarm, 'critical')
    const same = view('q'); assert.equal(withAlarmState(same, worst), same, 'no copy is made when nothing changes')
  })
  await t('when the alarm is resolved the helmet\'s alarm state goes away', () => {
    assert.equal(withAlarmState(view('a'), worstOpenAlarms([alarm('a', 'critical', 'resolved')])).activeAlarm, null)
  })
}
main().then(report)
