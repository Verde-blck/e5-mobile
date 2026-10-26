import type { AlarmSeverity } from '@/modules/alarms/types'
import type { GasReading } from '@/shared/lib/api-normalize'

export type { AlarmSeverity }

export type ConnectivityType = 'sim' | 'wifi'

export type FixType = 'gps' | 'network' | 'wifi' | 'other'
export type SimStatus = 0 | 1 | 2

export type Presence = 'online' | 'degraded' | 'offline'

export interface Telemetry {
  batteryPercent?: number
  batteryVoltage?: number
  lat?: number
  lng?: number
  altitude?: number
  speed?: number
  heading?: number
  signalStrength?: number
  networkType?: string
  carrier?: string
  fixType?: FixType
  gpsLevel?: number
  accuracyMeters?: number
  simStatus?: SimStatus
  simPhoneNumber?: string
  simDataUsedMb?: number
  isWorn?: boolean
  isCharging?: boolean
  isRecording?: boolean
  // Sensors that aren't fitted are omitted rather than reported as zero.
  gas?: GasReading[]
  gasAt?: number
}

// Deliberately not a link to a dashboard account, the worker wearing the helmet never signs in here.
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
  name: string
  named?: boolean
  site?: string
  assignedTo?: DeviceAssignment
  worker?: Worker
  active: boolean
  connectivity: ConnectivityType
  lastSeenAt: number
  activeAlarm: AlarmSeverity | null
  telemetry: Telemetry
}

export interface DeviceView extends Device {
  presence: Presence
}

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
  fixType?: FixType
  accuracyMeters?: number
  gas?: GasReading[]
}

export type HistoryRange = '1h' | '24h' | '7d'

// Using the server's numbers rather than counting locally means the overview can't drift from
// what the backend believes, and it stays correct if the device list is ever paginated.
export interface FleetSummary {
  total: number
  online: number
  offline: number
  active: number
  inactive: number
  alarms24h: number
}
