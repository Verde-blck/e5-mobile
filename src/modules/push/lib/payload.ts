import type { PushMessage } from '../types'

// The alarm id ends up in a route (/alarm/{id}), so only plain id characters are accepted.
const ID = /^[A-Za-z0-9_-]{1,64}$/

function text(value: unknown, max: number): string | undefined {
  const v = typeof value === 'number' && Number.isFinite(value) ? String(value) : value
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  return trimmed ? trimmed.slice(0, max) : undefined
}

/**
 * What a push is about, from its data payload (FCM data values arrive as strings), or null if it
 * isn't one of ours or is malformed. Nothing from a notification is trusted: it came through the
 * tablet's notification tray, not through the signed-in API connection.
 */
export function parsePushData(raw: unknown): PushMessage | null {
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>

  // An id is checked as it arrived, never trimmed to fit: a cut-down id would open the wrong alarm.
  const rawId = typeof d.alarmId === 'number' && Number.isFinite(d.alarmId) ? String(d.alarmId) : d.alarmId
  const alarmId = typeof rawId === 'string' ? rawId.trim() : ''
  if (!ID.test(alarmId)) return null

  if (d.kind === 'alarm-resolved') return { kind: 'alarm-resolved', alarmId }
  if (d.kind !== 'alarm') return null

  return {
    kind: 'alarm',
    alarmId,
    alarmType: text(d.alarmType, 40),
    severity: d.severity === 'critical' ? 'critical' : d.severity === 'warning' ? 'warning' : undefined,
    deviceId: text(d.deviceId, 32),
    deviceName: text(d.deviceName, 80),
  }
}
