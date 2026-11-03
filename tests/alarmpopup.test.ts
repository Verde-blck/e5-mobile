import assert from 'node:assert/strict'
import { alarmDetail, alarmTitle, gasReadingLine, subjectLine } from '@/modules/alarms/lib/alarm-copy'
import { ALERT_WINDOW_MS, awaitingAction, popupFor } from '@/modules/alarms/lib/alert-policy'
import { ALARM_LABELS, severityForType, type Alarm, type AlarmType } from '@/modules/alarms/types'
import type { Device } from '@/modules/devices/types'
import { createRunner } from './harness'

const { t, report } = createRunner()
const NOW = 1_700_000_000_000
const alarm = (id: string, type: AlarmType, agoMs: number, over: Partial<Alarm> = {}): Alarm => ({
  id, deviceId: 'd1', deviceName: 'Test Helmet', type, severity: severityForType(type), status: 'active', raisedAt: NOW - agoMs, ...over,
})
const device = (over: Partial<Device> = {}, gas: Array<{ gas: string; value: number }> = [], gasAt?: number): Device =>
  ({ id: 'd1', name: 'Test Helmet', named: true, active: true, connectivity: 'sim', lastSeenAt: NOW, activeAlarm: null, telemetry: { gas, gasAt }, ...over }) as Device

async function main() {
  await t('the short title is "SOS pressed" for both kinds of SOS, and the alarm\'s own name for the rest', () => {
    assert.equal(alarmTitle('sos'), 'SOS pressed'); assert.equal(alarmTitle('sos-button'), 'SOS pressed')
    assert.deepEqual((['gas-co', 'gas-h2s', 'gas-ch4', 'gas-o2-low'] as AlarmType[]).map(alarmTitle), ['Carbon monoxide', 'Hydrogen sulphide', 'Methane', 'Low oxygen'])
    assert.equal(alarmTitle('fall'), 'Fall or impact'); assert.equal(alarmTitle('helmet-removal'), 'Helmet removed')
  })
  await t('every alarm type has a title and a one-line detail, so a new type cannot reach the pop-up with nothing to say', () => {
    for (const type of Object.keys(ALARM_LABELS) as AlarmType[]) {
      assert.ok(alarmTitle(type).length > 0, `${type} has a title`)
      const detail = alarmDetail(type)
      assert.ok(detail.length > 10 && detail.endsWith('.') && !detail.includes('\n'), `${type} has a one-line detail: ${detail}`)
    }
  })
  await t('a gas alarm names the gas in its detail, and the others do not mention one', () => {
    assert.match(alarmDetail('gas-co'), /carbon monoxide/i); assert.match(alarmDetail('gas-h2s'), /hydrogen sulphide/i)
    assert.match(alarmDetail('gas-ch4'), /methane/i); assert.match(alarmDetail('gas-o2-low'), /oxygen/i)
    assert.doesNotMatch(alarmDetail('sos'), /gas|monoxide|methane/i)
  })

  await t('a gas alarm shows the helmet\'s latest reading of that gas, with how old it is', () => {
    const d = device({}, [{ gas: 'CH4', value: 0 }, { gas: 'CO', value: 52 }], NOW - 20_000)
    assert.equal(gasReadingLine('gas-co', d, NOW), 'Latest reading: CO 52 (20s ago)')
    assert.equal(gasReadingLine('gas-ch4', d, NOW), 'Latest reading: CH4 0 (20s ago)')
    assert.equal(gasReadingLine('gas-co', device({}, [{ gas: 'co', value: 7 }], NOW - 125_000), NOW), 'Latest reading: CO 7 (2m ago)', 'the symbol is matched in any case')
  })
  await t('there is no reading line when there is nothing honest to show', () => {
    assert.equal(gasReadingLine('gas-h2s', device({}, [{ gas: 'CO', value: 52 }], NOW), NOW), null, 'the helmet has not reported that gas')
    assert.equal(gasReadingLine('gas-co', undefined, NOW), null, 'the helmet is not in the list')
    assert.equal(gasReadingLine('sos', device({}, [{ gas: 'CO', value: 52 }], NOW), NOW), null, 'not a gas alarm')
    assert.equal(gasReadingLine('gas-co', device({}, [{ gas: 'CO', value: 52 }]), NOW), 'Latest reading: CO 52', 'no time known: no age claimed')
  })

  await t('it names the wearer and the helmet when a worker is assigned, and the helmet alone when not', () => {
    const worker = { name: 'John Ade', staffId: 'E5-014', phone: '+2348031234567' }
    assert.equal(subjectLine({ deviceName: 'x' }, device({ worker })), 'John Ade \u00b7 Test Helmet')
    assert.equal(subjectLine({ deviceName: 'x' }, device()), 'Test Helmet')
    assert.equal(subjectLine({ deviceName: '...59020' }, undefined), '...59020', 'a helmet not in the list falls back to the alarm\'s own name')
  })

  await t('SOS and danger alarms get the box, and warnings get the banner', () => {
    for (const type of ['sos', 'sos-button', 'fall', 'near-electric', 'silent', 'gas-co', 'gas-h2s', 'gas-ch4', 'gas-o2-low'] as AlarmType[]) assert.equal(popupFor(alarm('1', type, 0)), 'modal', type)
    for (const type of ['helmet-removal', 'geofence', 'restricted-area', 'temperature', 'ascending', 'beacon-enter', 'heart-rate', 'voice-message', 'other'] as AlarmType[]) assert.equal(popupFor(alarm('1', type, 0)), 'banner', type)
  })

  await t('the alarms waiting for someone come newest first, and only critical, active and recent ones', () => {
    const list = [
      alarm('a', 'sos', 5 * 60_000), alarm('b', 'gas-co', 60_000), alarm('c', 'geofence', 1000), alarm('d', 'fall', 2000, { status: 'resolved' }),
      alarm('e', 'sos', ALERT_WINDOW_MS + 1000), alarm('f', 'near-electric', 4 * 60_000),
    ]
    assert.deepEqual(awaitingAction(list, {}, NOW).map((a) => a.id), ['b', 'f', 'a'], 'a warning, a resolved alarm and one past the window are left out')
  })
  await t('acting on an alarm brings up the next, and the siren condition (anything waiting) ends only when the last is handled', () => {
    const list = [alarm('a', 'sos', 3000), alarm('b', 'gas-h2s', 2000), alarm('c', 'fall', 1000)]
    assert.deepEqual(awaitingAction(list, {}, NOW).map((a) => a.id), ['c', 'b', 'a'])
    assert.deepEqual(awaitingAction(list, { c: true }, NOW).map((a) => a.id), ['b', 'a'], 'the one acted on is gone, the others still wait')
    assert.equal(awaitingAction(list, { c: true, b: true }, NOW).length, 1)
    assert.equal(awaitingAction(list, { a: true, b: true, c: true }, NOW).length, 0, 'every alarm handled: quiet')
  })
  await t('a new alarm arriving after one was handled is not hidden by it', () => {
    const handled = { a: true } as const
    assert.deepEqual(awaitingAction([alarm('a', 'sos', 60_000), alarm('z', 'gas-co', 0)], handled, NOW).map((x) => x.id), ['z'])
  })
  await t('resolving an alarm elsewhere takes it off the list, even if nobody acted on it here', () => {
    assert.equal(awaitingAction([alarm('a', 'sos', 1000, { status: 'resolved' })], {}, NOW).length, 0)
  })
}
main().then(report)
