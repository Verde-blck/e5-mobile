import type { AlarmSeverity } from '@/modules/alarms/types'
import type { GasReading } from '@/shared/lib/api-normalize'

export type { AlarmSeverity }

export type ConnectivityType = 'sim' | 'wifi'

export type FixType = 'gps' | 'network' | 'wifi' | 'other'
export type SimStatus = 0 | 1 | 2

/** Derived from lastSeenAt — never sent by the server. See lib/presence.ts. */
export type Presence = 'online' | 'degraded' | 'offline'

/**
 * Device-reported state, per FRD §4 Real-Time Monitoring.
 *
 * Every field is optional, and that is the whole point. The FRD qualifies each
 * of these with "where available" / "where supplied by the device", because
 * which of them a given helmet actually reports isn't known until the firmware
 * is on the bench. A required field that the device never sends becomes a
 * fake zero in the UI; an optional one renders as "not reported", which is the
 * truth. The detail view builds its rows from whatever is present.
 */
export interface Telemetry {
  batteryPercent?: number
  batteryVoltage?: number // FRD asks for level AND voltage — they diverge as cells age
  lat?: number
  lng?: number
  altitude?: number
  speed?: number
  heading?: number
  /** Signal bars, 0–5 (the API's lastNetStrength). */
  signalStrength?: number
  networkType?: string // 'wifi' or '4g'
  carrier?: string
  /**
   * How the position was worked out. Indoors a helmet reads 'network' (mobile
   * mask, can be hundreds of metres out) and should be shown as approximate.
   */
  fixType?: FixType
  /** GPS signal: 1 strong, 0 weak, -1 none. */
  gpsLevel?: number
  /** The helmet's own accuracy radius, in metres. */
  accuracyMeters?: number
  /** SIM: 0 unknown, 1 present, 2 no SIM. */
  simStatus?: SimStatus
  simPhoneNumber?: string
  /** Mobile data used this month. */
  simDataUsedMb?: number
  isWorn?: boolean
  isCharging?: boolean
  isRecording?: boolean
  /**
   * Gas sensor readings. This helmet is a gas detector — the protocol reports
   * up to twelve gases, of which a given unit carries only some. Sensors that
   * aren't fitted are omitted rather than reported as zero.
   */
  gas?: GasReading[]
  /** When the gas readings were taken; can be older than lastSeenAt. */
  gasAt?: number
}

/**
 * Identity and registration data (from your database) kept separate from
 * telemetry (from the helmet). That split mirrors FRD §4 Device Management vs
 * §4 Real-Time Monitoring, and it means a device row still renders correctly
 * for a helmet that has been registered but has never connected.
 */
/**
 * Who wears this helmet.
 *
 * FRD §4 Device Management: "manage device assignment/ownership information".
 * Deliberately not a link to a dashboard account — the worker wearing the
 * helmet never signs in here. Every dashboard user is an administrator.
 */
/** The person a helmet is assigned to (PUT /api/devices/{id}/worker). Only the name is required. */
export interface Worker {
  name: string
  staffId?: string
  phone?: string
}

export interface DeviceAssignment {
  name: string
  phone?: string
  jobTitle?: string
}

export interface Device {
  id: string
  /** Display name. The API has no name field yet, so this falls back to a
   *  short form of the device ID — see devices.api.ts. */
  name: string
  /** Not supplied by the API. Optional until it is. */
  /**
   * False when the helmet has no name yet and `name` is the shortened device
   * ID instead ("…56404"). Lets the UI avoid showing the ID twice. Undefined
   * is treated as named.
   */
  named?: boolean
  site?: string
  assignedTo?: DeviceAssignment
  /** Who is assigned to wear it. Absent shows as "Unassigned". */
  worker?: Worker
  /**
   * Registration state, set by an administrator — distinct from presence.
   * A deactivated helmet can still be connected and reporting.
   */
  active: boolean
  connectivity: ConnectivityType
  lastSeenAt: number
  activeAlarm: AlarmSeverity | null
  telemetry: Telemetry
}

/** A Device with presence resolved against the current clock. */
export interface DeviceView extends Device {
  presence: Presence
}

/** A single stored heartbeat. Backs the status-history views. */
export interface TelemetrySample {
  ts: number
  batteryPercent?: number
  batteryVoltage?: number
  connectivity?: ConnectivityType
  signalStrength?: number
  lat?: number
  lng?: number
  altitude?: number
  isCharging?: boolean
  isWorn?: boolean
  /** How the position was worked out (older rows have none, and count as GPS). */
  fixType?: FixType
  accuracyMeters?: number
  /** Per-sample gas readings, so a history view can chart exposure over time. */
  gas?: GasReading[]
}

export type HistoryRange = '1h' | '24h' | '7d'

/**
 * The window the API actually served, returned alongside the samples.
 *
 * stepMs matters downstream: history is downsampled server-side, so a gap in
 * the data can't be read against the 30s live heartbeat interval. At 30-minute
 * resolution every sample looks like a half-hour outage. See lib/history.ts.
 */
export interface TelemetryWindow {
  range: HistoryRange
  rangeStart: number
  rangeEnd: number
  stepMs: number
  samples: TelemetrySample[]
}

/**
 * Pre-counted fleet totals from GET /api/dashboard/summary.
 *
 * Using the server's numbers rather than counting locally means the overview
 * can't drift from what the backend believes — and it stays correct if the
 * device list is ever paginated.
 */
export interface FleetSummary {
  total: number
  online: number
  offline: number
  active: number
  inactive: number
  alarms24h: number
}
