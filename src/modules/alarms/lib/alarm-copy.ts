import type { Device } from '@/modules/devices/types'
import { lastSeenLabel } from '@/modules/devices/lib/presence'
import { alarmLabel, type Alarm, type AlarmType } from '../types'

/** The short heading: "SOS pressed", "Carbon monoxide", "Helmet removed". */
export function alarmTitle(type: AlarmType): string {
  return type === 'sos' || type === 'sos-button' ? 'SOS pressed' : alarmLabel(type)
}

const DETAIL: Record<AlarmType, string> = {
  sos: 'The wearer pressed the SOS button.',
  'sos-button': 'The wearer pressed the SOS button and is asking for a call.',
  fall: 'A fall or hard impact was detected.',
  'near-electric': 'The wearer is close to live electrical equipment.',
  silent: 'The wearer has not moved for a while.',
  'gas-co': 'A dangerous level of carbon monoxide was detected.',
  'gas-h2s': 'A dangerous level of hydrogen sulphide was detected.',
  'gas-ch4': 'A dangerous level of methane was detected.',
  'gas-o2-low': 'The oxygen level has dropped to a dangerous level.',
  'helmet-removal': 'The helmet was taken off.',
  geofence: 'The wearer left the work area.',
  'restricted-area': 'The wearer entered a restricted area.',
  temperature: 'The helmet is reporting a high temperature.',
  ascending: 'The wearer is working at height.',
  'beacon-enter': 'The wearer entered a beacon zone.',
  'beacon-leave': 'The wearer left a beacon zone.',
  'body-temperature': 'The wristband is reporting a high body temperature.',
  'heart-rate': 'The wristband is reporting an abnormal heart rate.',
  'blood-pressure': 'The wristband is reporting abnormal blood pressure.',
  'voice-message': 'The wearer sent a voice message.',
  other: 'An event the app has no name for yet.',
}

export function alarmDetail(type: AlarmType): string {
  return DETAIL[type]
}

// The gas symbol the helmet reports for each gas alarm, so the alarm can show the reading beside it.
const GAS_SYMBOL: Partial<Record<AlarmType, string>> = { 'gas-co': 'CO', 'gas-h2s': 'H2S', 'gas-ch4': 'CH4', 'gas-o2-low': 'O2' }

/** "Latest reading: CO 52 (20s ago)" for a gas alarm, when the helmet has reported that gas; otherwise nothing. */
export function gasReadingLine(type: AlarmType, device: Device | undefined, now: number): string | null {
  const symbol = GAS_SYMBOL[type]
  const reading = symbol ? device?.telemetry.gas?.find((g) => g.gas.toUpperCase() === symbol) : undefined
  if (!symbol || !reading) return null
  const at = device?.telemetry.gasAt
  return `Latest reading: ${symbol} ${reading.value}${at ? ` (${lastSeenLabel(at, now)})` : ''}`
}

/** Who it is about: the wearer and the helmet when a worker is assigned, otherwise the helmet alone. */
export function subjectLine(alarm: Pick<Alarm, 'deviceName'>, device: Device | undefined): string {
  const helmet = device?.name ?? alarm.deviceName
  return device?.worker?.name ? `${device.worker.name} \u00b7 ${helmet}` : helmet
}
