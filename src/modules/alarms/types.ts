/**
 * The alarm vocabulary, matched to the helmet protocol's numeric codes.
 *
 * The device module imports AlarmSeverity from here rather than redeclaring
 * it — one definition, so a new severity can't mean two different things.
 */
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
  | 'other'

export type AlarmSeverity = 'critical' | 'warning'

/**
 * Two states, matching the backend exactly.
 *
 * An earlier design had a middle "acknowledged" state — seen but not yet
 * fixed — which is genuinely useful during an incident. The API has only
 * resolved/unresolved and endpoints to flip between them, so the dashboard
 * matches rather than inventing a state the server can't store. Worth
 * revisiting if the client asks for triage.
 */
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

/**
 * Every alarmType the backend can send, from the helmet manufacturer's
 * protocol (SolloLink, Sept 2025, section 4 "Alarm Push") plus the two codes
 * the backend creates itself. Confirmed by the backend on 16 Oct 2026.
 *
 * Numeric codes arrive as strings ("7", not 7). Codes 8–10, 13–16 and 19
 * aren't in the manufacturer's list; anything unexpected is "Other event".
 * Fence alarms use 2 and 5 whether the helmet or the backend's geofence
 * check raised them.
 */
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
  // 17–18 need Bluetooth beacons installed on site; 20–22 need the wristband.
  '17': 'beacon-enter',
  '18': 'beacon-leave',
  '20': 'body-temperature',
  '21': 'heart-rate',
  '22': 'blood-pressure',
  // Raised by the backend, not the helmet.
  manual_sos_button: 'sos-button',
  voice_message: 'voice-message',
}

export function alarmTypeFromCode(code: unknown): AlarmType {
  if (code === null || code === undefined) return 'other'
  // Anything unrecognised becomes a generic event rather than being dropped —
  // firmware can raise codes this table doesn't know about yet.
  return CODE_TO_TYPE[String(code).trim()] ?? 'other'
}

/** Named after what actually happened, as the client asked. */
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
  other: 'Other event',
}

/**
 * Either kind of SOS. Code 7 is the helmet's own SOS; manual_sos_button is
 * the button held down, which also puts the helmet into a call. Both get the
 * SOS banner and a Join SOS call button, so every SOS check goes through here.
 */
export function isSos(type: AlarmType): boolean {
  return type === 'sos' || type === 'sos-button'
}

export function alarmLabel(type: string): string {
  return ALARM_LABELS[type as AlarmType] ?? ALARM_LABELS.other
}

/**
 * Severity is derived, because the API doesn't send one.
 *
 * Critical means someone may be in immediate danger: either kind of SOS, a
 * fall or impact, contact with live electricity, or no movement, since a
 * worker who has stopped moving may be unconscious. The wristband alarms
 * stay warnings until the client says otherwise.
 */
const CRITICAL: ReadonlySet<AlarmType> = new Set<AlarmType>([
  'sos',
  'sos-button',
  'fall',
  'near-electric',
  'silent',
])

export function severityForType(type: AlarmType): AlarmSeverity {
  return CRITICAL.has(type) ? 'critical' : 'warning'
}

export function isActive(alarm: Alarm): boolean {
  return alarm.status === 'active'
}
