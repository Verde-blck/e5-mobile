import { alarmLabel, type Alarm } from '@/modules/alarms/types'
import { describeFix } from '@/modules/devices/lib/location'
import type { DeviceView, Presence } from '@/modules/devices/types'
import type { Fence } from '@/modules/fences/types'
import type { MapAlarm, MapDraft, MapFence, MapHelmet } from '../types'

// A usable position is finite, in the world's range and not (0, 0): a helmet with no
// fix can report 0, 0 ("null island"), which would draw it in the Atlantic.
export function hasPosition(lat: number | undefined, lng: number | undefined): boolean {
  if (lat === undefined || lng === undefined) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  return !(lat === 0 && lng === 0)
}

export function buildMapHelmets(
  devices: readonly DeviceView[],
  activeAlarms: readonly Alarm[]
): { placed: MapHelmet[]; unplaced: DeviceView[] } {
  const worst = new Map<string, 'critical' | 'warning'>()
  for (const alarm of activeAlarms) {
    if (alarm.status !== 'active') continue
    if (worst.get(alarm.deviceId) === 'critical') continue
    worst.set(alarm.deviceId, alarm.severity)
  }

  const placed: MapHelmet[] = []
  const unplaced: DeviceView[] = []
  for (const device of devices) {
    const { lat, lng, accuracyMeters } = device.telemetry
    if (!hasPosition(lat, lng)) {
      unplaced.push(device)
      continue
    }
    placed.push({
      id: device.id,
      name: device.name,
      lat: lat as number,
      lng: lng as number,
      presence: device.presence,
      accuracy: accuracyMeters !== undefined && accuracyMeters > 0 ? accuracyMeters : undefined,
      approximate: describeFix(device.telemetry)?.approximate ?? false,
      alarm: worst.get(device.id) ?? null,
    })
  }
  return { placed, unplaced }
}

export function buildMapAlarms(alarms: readonly Alarm[]): MapAlarm[] {
  return alarms
    .filter((a) => a.status === 'active' && hasPosition(a.lat, a.lng))
    .map((a) => ({
      id: a.id,
      lat: a.lat as number,
      lng: a.lng as number,
      severity: a.severity,
      label: alarmLabel(a.type),
      deviceName: a.deviceName,
    }))
}

export function countByPresence(helmets: readonly MapHelmet[]): Record<Presence | 'all', number> {
  const counts = { all: helmets.length, online: 0, degraded: 0, offline: 0 }
  for (const h of helmets) counts[h.presence] += 1
  return counts
}

export function toMapFence(fence: Fence): MapFence {
  return { id: fence.id, type: fence.type, behavior: fence.behavior, active: fence.active, center: fence.center, radiusMeters: fence.radiusMeters, points: fence.points }
}

export function toMapDraft(draft: Pick<MapDraft, 'type' | 'behavior' | 'active' | 'center' | 'radiusMeters' | 'points'>): MapDraft {
  return { type: draft.type, behavior: draft.behavior, active: draft.active, center: draft.center, radiusMeters: draft.radiusMeters, points: draft.points }
}
