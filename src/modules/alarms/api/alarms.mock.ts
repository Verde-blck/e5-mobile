import { Asset } from 'expo-asset'
import type { ApiAlarm, ApiAlarmDetail } from './alarms.wire'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const iso = (agoMs: number) => new Date(Date.now() - agoMs).toISOString()

const TEST_HELMET = '866652022956404'
const RIG = '866652022956412'
const WELDING = '866652022958103'
const YARD = '866652022958277'
const UNNAMED = '866652022959020'

function seed(): ApiAlarm[] {
  return [
    { id: 1006, deviceId: YARD, alarmType: '4', latitude: '6.4335', longitude: '3.4260', occurredAt: iso(50 * MIN), resolved: false },
    { id: 1005, deviceId: WELDING, alarmType: '1', latitude: '6.4620', longitude: '3.4105', occurredAt: iso(12 * MIN), resolved: false },
    { id: 1004, deviceId: TEST_HELMET, alarmType: 'manual_sos_button', latitude: '6.4474', longitude: '3.4012', occurredAt: iso(3 * HOUR), resolved: true },
    { id: 1003, deviceId: RIG, alarmType: '2', latitude: '6.4601', longitude: '3.3902', occurredAt: iso(1 * DAY), resolved: true },
    { id: 1002, deviceId: UNNAMED, alarmType: '6', latitude: null, longitude: null, occurredAt: iso(2 * DAY), resolved: false },
    { id: 1001, deviceId: TEST_HELMET, alarmType: '7', latitude: '6.4470', longitude: '3.4010', occurredAt: iso(3 * DAY), resolved: true },
  ]
}

let store: ApiAlarm[] | null = null
const alarms = () => (store ??= seed())

export function getMockAlarms(): ApiAlarm[] {
  return alarms().map((a) => ({ ...a }))
}

type Handler = (alarm: ApiAlarm) => void
const onAlarm = new Set<Handler>()
const onUpdate = new Set<Handler>()

export function subscribeMockStream(alarmHandler: Handler, updateHandler: Handler): () => void {
  onAlarm.add(alarmHandler)
  onUpdate.add(updateHandler)
  return () => {
    onAlarm.delete(alarmHandler)
    onUpdate.delete(updateHandler)
  }
}

let nextId = 2000

const AT: Record<string, [string, string]> = {
  [TEST_HELMET]: ['6.4474', '3.4012'],
  [RIG]: ['6.4531', '3.3958'],
  [WELDING]: ['6.4620', '3.4105'],
  [YARD]: ['6.4335', '3.4260'],
}

export function simulateAlarm(code: string, deviceId: string = TEST_HELMET): ApiAlarm {
  const alarm: ApiAlarm = {
    id: nextId++,
    deviceId,
    alarmType: code,
    latitude: (AT[deviceId] ?? AT[TEST_HELMET])[0],
    longitude: (AT[deviceId] ?? AT[TEST_HELMET])[1],
    occurredAt: new Date().toISOString(),
    resolved: false,
  }
  alarms().unshift(alarm)
  onAlarm.forEach((h) => h({ ...alarm }))
  return alarm
}

export function setMockAlarmResolved(id: string, resolved: boolean): void {
  const alarm = alarms().find((a) => String(a.id) === id)
  if (!alarm) return
  alarm.resolved = resolved
  onUpdate.forEach((h) => h({ ...alarm }))
}

const asset = (module: number): string => Asset.fromModule(module).uri

export function getMockAlarmDetail(id: string): ApiAlarmDetail | undefined {
  const alarm = alarms().find((a) => String(a.id) === id)
  if (!alarm) return undefined

  const age = Date.now() - Date.parse(alarm.occurredAt ?? '')
  const photo = {
    id: alarm.id * 10,
    deviceId: alarm.deviceId,
    imageUrl: asset(require('../../../../assets/mock-footage.jpg')),
    latitude: alarm.latitude,
    longitude: alarm.longitude,
    alarmId: alarm.id,
    capturedAt: alarm.occurredAt,
  }
  const clip = {
    id: alarm.id * 10 + 1,
    deviceId: alarm.deviceId,
    videoUrl: asset(require('../../../../assets/mock-clip.mp4')),
    fileName: '20261013101500.mp4',
    fileSizeBytes: 1_450_000,
    recordedAt: '2026-10-13T10:15:00',
    recordedDate: '2026-10-13',
    alarmId: alarm.id,
  }

  const photos = alarm.id === 1001 || alarm.id === 1006 || (alarm.id >= 2000 && age > 10_000) ? [photo] : []
  const videos = alarm.id === 1001 ? [clip] : []
  return { ...alarm, photos, videos }
}
