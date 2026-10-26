import { derivePresence } from '../lib/presence'
import type { Worker, Device, FleetSummary } from '../types'

const MIN = 60_000
const HOUR = 60 * MIN

const CLEAN_AIR = [
  { gas: 'CH4', value: 0 },
  { gas: 'O2', value: 20.9 },
  { gas: 'CO', value: 0 },
  { gas: 'H2S', value: 0 },
]

function helmet(
  id: string,
  name: string | null,
  agoMs: number | null,
  over: Partial<Device['telemetry']> = {},
  active = true
): Device {
  const lastSeenAt = agoMs === null ? 0 : Date.now() - agoMs
  return {
    id,
    name: name ?? `…${id.slice(-5)}`,
    named: name !== null,
    active,
    connectivity: 'sim',
    lastSeenAt,
    activeAlarm: null,
    telemetry: {
      batteryPercent: 80,
      lat: 6.4474,
      lng: 3.4012,
      isWorn: true,
      signalStrength: 4,
      fixType: 'gps',
      gpsLevel: 1,
      accuracyMeters: 4.2,
      simStatus: 1,
      simDataUsedMb: 0,
      networkType: '4g',
      gas: [],
      ...over,
    },
  }
}

const networkOverride = new Map<string, 'wifi' | '4g'>()

const workerOverride = new Map<string, Worker | null>([['866652022956404', { name: 'John Ade', staffId: 'E5-014', phone: '+2348031234567' }]])

export function setMockWorker(id: string, worker: Worker | null): void {
  workerOverride.set(id, worker)
}

export function setMockNetwork(id: string, networkType: 'wifi' | '4g'): void {
  networkOverride.set(id, networkType)
}

export function getMockFleet(): Device[] {
  const gasAt = Date.now() - 20_000
  const fleet = [
    helmet('866652022956404', 'Test Helmet', 18_000, {
      batteryPercent: 83,
      gas: CLEAN_AIR,
      gasAt,
      signalStrength: 5,
      accuracyMeters: 2.6,
      simPhoneNumber: '+234 803 555 0142',
      simDataUsedMb: 184.5,
    }),
    helmet('866652022956412', 'Rig Supervisor', 40_000, {
      batteryPercent: 64,
      lat: 6.4531,
      lng: 3.3958,
      gas: CLEAN_AIR,
      gasAt,
      fixType: 'network',
      gpsLevel: -1,
      accuracyMeters: 640,
      simDataUsedMb: 52.1,
    }),
    helmet('866652022957881', null, 55_000, { lat: 6.4402, lng: 3.4168, batteryPercent: 91, signalStrength: 2, fixType: 'wifi', accuracyMeters: 35, networkType: 'wifi', simStatus: 2 }),
    helmet('866652022958103', 'Welding Bay 2', 3 * MIN, {
      lat: 6.462,
      lng: 3.4105,
      batteryPercent: 38,
      isWorn: false,
      signalStrength: 1,
      gpsLevel: 0,
      accuracyMeters: 28,
    }),
    helmet('866652022958277', 'Yard Patrol', 9 * MIN, { lat: 6.4335, lng: 3.426, batteryPercent: 17, isWorn: false }),
    helmet('866652022959020', null, 3 * HOUR, { batteryPercent: 52, lat: undefined, lng: undefined }),
    helmet('866652022959544', 'Spare Unit 1', 2 * 24 * HOUR, { lat: 6.458, lng: 3.3801, batteryPercent: 9 }, false),
    helmet('866652022960011', 'Unboxed Unit', null, { batteryPercent: undefined, lat: undefined, lng: undefined }, true),
  ]
  return fleet.map((base) => {
    const offline = derivePresence(base.lastSeenAt, Date.now()) === 'offline'
    const worker = workerOverride.get(base.id)
    const device: Device = { ...base, worker: worker ?? undefined, telemetry: offline ? { ...base.telemetry, isWorn: undefined } : base.telemetry }
    const networkType = networkOverride.get(device.id)
    return networkType ? { ...device, connectivity: networkType === 'wifi' ? ('wifi' as const) : ('sim' as const), telemetry: { ...device.telemetry, networkType } } : device
  })
}

export function getMockDevice(id: string): Device | undefined {
  return getMockFleet().find((d) => d.id === id)
}

export function getMockSummary(): FleetSummary {
  const fleet = getMockFleet()
  const now = Date.now()
  const online = fleet.filter((d) => derivePresence(d.lastSeenAt, now) === 'online').length
  const active = fleet.filter((d) => d.active).length
  return {
    total: fleet.length,
    online,
    offline: fleet.length - online,
    active,
    inactive: fleet.length - active,
    alarms24h: 3,
  }
}
