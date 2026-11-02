export type AlarmType =
  | 'sos'
  | 'sos-button'
  | 'fall'
  | 'helmet-removal'
  | 'geofence'
  | 'restricted-area'
  | 'temperature'
  | 'silent'
  | 'near-electric'
  | 'ascending'
  | 'beacon-enter'
  | 'beacon-leave'
  | 'body-temperature'
  | 'heart-rate'
  | 'blood-pressure'
  | 'voice-message'
  | 'gas-co'
  | 'gas-h2s'
  | 'gas-ch4'
  | 'gas-o2-low'
  | 'other'

export type AlarmSeverity = 'critical' | 'warning'

// The API has only resolved/unresolved and endpoints to flip between them, so the
// dashboard matches rather than inventing a state the server can't store.
export type AlarmStatus = 'active' | 'resolved'

export interface Alarm {
  id: string
  deviceId: string
  deviceName: string
  site?: string
  type: AlarmType
  severity: AlarmSeverity
  status: AlarmStatus
  raisedAt: number
  resolvedAt?: number
  resolvedBy?: string
  lat?: number
  lng?: number
  note?: string
}

const CODE_TO_TYPE: Record<string, AlarmType> = {
  '1': 'helmet-removal',
  '2': 'geofence',
  '3': 'temperature',
  '4': 'fall',
  '5': 'restricted-area',
  '6': 'silent',
  '7': 'sos',
  '11': 'near-electric',
  '12': 'ascending',
  '17': 'beacon-enter',
  '18': 'beacon-leave',
  '20': 'body-temperature',
  '21': 'heart-rate',
  '22': 'blood-pressure',
  manual_sos_button: 'sos-button',
  voice_message: 'voice-message',
}

// The backend's gas alarm codes weren't documented, so textual codes are recognised by the gas they name
// (gas_co, H2S_HIGH, ch4_lel, low_oxygen...). Numeric ones would need adding to the table above.
const GAS_TOKENS: [AlarmType, RegExp][] = [
  ['gas-h2s', /^(h2s|hydrogen ?sul[pf]h?ide)$/],
  ['gas-ch4', /^(ch4|methane|lel|combustible|flammable)$/],
  ['gas-o2-low', /^(o2|oxygen)$/],
  ['gas-co', /^(co|carbon ?monoxide)$/],
]

function gasTypeFromCode(code: string): AlarmType | null {
  const tokens = code
    .toLowerCase()
    .replace(/carbon[_\s-]?monoxide/g, 'carbonmonoxide')
    .replace(/hydrogen[_\s-]?sul[pf]h?ide/g, 'hydrogensulphide')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.replace('carbonmonoxide', 'carbon monoxide').replace('hydrogensulphide', 'hydrogen sulphide'))
  for (const [type, pattern] of GAS_TOKENS) {
    if (tokens.some((t) => pattern.test(t))) return type
  }
  return null
}

export function alarmTypeFromCode(code: unknown): AlarmType {
  if (code === null || code === undefined) return 'other'
  const raw = String(code).trim()
  // Anything unrecognised becomes a generic event rather than being
  // dropped, firmware can raise codes this table doesn't know about yet.
  return CODE_TO_TYPE[raw] ?? gasTypeFromCode(raw) ?? 'other'
}

export const ALARM_LABELS: Record<AlarmType, string> = {
  sos: 'SOS',
  'sos-button': 'SOS with call',
  fall: 'Fall or impact',
  'helmet-removal': 'Helmet removed',
  geofence: 'Left work area',
  'restricted-area': 'Entered restricted area',
  temperature: 'High temperature',
  silent: 'No movement',
  'near-electric': 'Near live electricity',
  ascending: 'Working at height',
  'beacon-enter': 'Entered beacon zone',
  'beacon-leave': 'Left beacon zone',
  'body-temperature': 'High body temperature',
  'heart-rate': 'Abnormal heart rate',
  'blood-pressure': 'Abnormal blood pressure',
  'voice-message': 'Voice message',
  'gas-co': 'Carbon monoxide',
  'gas-h2s': 'Hydrogen sulphide',
  'gas-ch4': 'Methane',
  'gas-o2-low': 'Low oxygen',
  other: 'Other event',
}

export function isSos(type: AlarmType): boolean {
  return type === 'sos' || type === 'sos-button'
}

export function alarmLabel(type: string): string {
  return ALARM_LABELS[type as AlarmType] ?? ALARM_LABELS.other
}

// Severity is derived, because the API doesn't send one. The
// wristband alarms stay warnings until the client says otherwise.
const CRITICAL: ReadonlySet<AlarmType> = new Set<AlarmType>([
  'sos',
  'sos-button',
  'fall',
  'near-electric',
  'silent',
  'gas-co',
  'gas-h2s',
  'gas-ch4',
  'gas-o2-low',
])

export function severityForType(type: AlarmType): AlarmSeverity {
  return CRITICAL.has(type) ? 'critical' : 'warning'
}

