import assert from 'node:assert/strict'
import { toAlarm } from '@/modules/alarms/api/alarms.api'
import { ALARM_ICONS } from '@/modules/alarms/components/alarm-style'
import { ALARM_LABELS, alarmLabel, alarmTypeFromCode, severityForType, type AlarmType } from '@/modules/alarms/types'
import { createRunner } from './harness'

const { t, report } = createRunner()
const GAS: AlarmType[] = ['gas-co', 'gas-h2s', 'gas-ch4', 'gas-o2-low']

async function main() {
  await t('each gas alarm is recognised from the way the backend might spell it', () => {
    const spellings: Record<string, string[]> = {
      'gas-co': ['gas_co', 'GAS_CO', 'co', 'CO', 'carbon monoxide', 'Carbon-Monoxide', 'carbon_monoxide_high'],
      'gas-h2s': ['h2s', 'H2S_HIGH', 'hydrogen sulphide', 'hydrogen_sulfide', 'Hydrogen-Sulphide'],
      'gas-ch4': ['ch4', 'ch4_lel', 'methane', 'LEL', 'combustible', 'flammable_gas'],
      'gas-o2-low': ['o2', 'O2_LOW', 'low_oxygen', 'oxygen_deficiency'],
    }
    for (const [type, codes] of Object.entries(spellings)) for (const code of codes) assert.equal(alarmTypeFromCode(code), type, `${code} -> ${type}`)
  })
  await t('words that merely contain a gas name are not mistaken for one', () => {
    for (const code of ['co2', 'cooling', 'record', 'gas', 'oxygenate_pump', 'colour', 'smoke', '']) assert.equal(alarmTypeFromCode(code), 'other', `"${code}" is not a gas alarm`)
  })
  await t('every code the app already knew still means what it meant, and unknown or missing ones are still "other"', () => {
    const known: Record<string, string> = { '1': 'helmet-removal', '2': 'geofence', '3': 'temperature', '4': 'fall', '5': 'restricted-area', '6': 'silent', '7': 'sos', '11': 'near-electric', '12': 'ascending', '17': 'beacon-enter', '18': 'beacon-leave', '20': 'body-temperature', '21': 'heart-rate', '22': 'blood-pressure', manual_sos_button: 'sos-button', voice_message: 'voice-message' }
    for (const [code, type] of Object.entries(known)) assert.equal(alarmTypeFromCode(code), type, code)
    for (const unknown of ['99', 'banana', null, undefined]) assert.equal(alarmTypeFromCode(unknown), 'other', String(unknown))
  })
  await t('they show under their own names, not as "Other event"', () => {
    assert.deepEqual(GAS.map((type) => alarmLabel(type)), ['Carbon monoxide', 'Hydrogen sulphide', 'Methane', 'Low oxygen'])
    assert.equal(alarmLabel('something-new'), 'Other event')
  })
  await t('all four are critical, so they get the banner and the siren; the others keep the severity they had', () => {
    for (const type of GAS) assert.equal(severityForType(type), 'critical', type)
    for (const type of ['sos', 'sos-button', 'fall', 'near-electric', 'silent'] as AlarmType[]) assert.equal(severityForType(type), 'critical', type)
    for (const type of ['helmet-removal', 'geofence', 'restricted-area', 'temperature', 'ascending', 'beacon-enter', 'beacon-leave', 'body-temperature', 'heart-rate', 'blood-pressure', 'voice-message', 'other'] as AlarmType[]) assert.equal(severityForType(type), 'warning', type)
  })
  await t('every alarm type has both a name and an icon, so a new one cannot be added to one table and forgotten in the other', () => {
    assert.deepEqual(Object.keys(ALARM_ICONS).sort(), Object.keys(ALARM_LABELS).sort())
    for (const type of GAS) assert.ok(ALARM_ICONS[type], `${type} has an icon`)
  })
  await t('a gas alarm arriving from the backend becomes a critical, named alarm', () => {
    const alarm = toAlarm({ id: 81, deviceId: '866652022956404', alarmType: 'gas_h2s', resolved: false, occurredAt: '2026-11-02T10:15:00Z' } as Parameters<typeof toAlarm>[0])
    assert.equal(alarm.type, 'gas-h2s'); assert.equal(alarm.severity, 'critical'); assert.equal(alarm.status, 'active'); assert.equal(alarmLabel(alarm.type), 'Hydrogen sulphide')
  })
}
main().then(report)
