import type { Device, DeviceView, Presence } from '../types'

// Matches the backend's own rule: online means a report in the last two minutes. It used to be ninety
// seconds, so the dashboard's summary count could disagree with the dots in its own device list, the
// kind of contradiction that makes an operator stop trusting a screen. The server owns the rule.
export const ONLINE_WINDOW_MS = 120_000

export const DEGRADED_WINDOW_MS = 10 * 60_000

// A helmet on a SIM drops routinely (cell handoff, a basement, a tunnel). If "online" meant an open
// socket the alarm feed would become noise within a day, so presence is a function of time since
// last contact. 'degraded' has no backend equivalent: it sits between online and offline so a
// helmet that just slipped out of coverage reads differently from one dark for an hour.
export function derivePresence(lastSeenAt: number, now: number): Presence {
  const age = now - lastSeenAt
  if (age < ONLINE_WINDOW_MS) return 'online'
  if (age < DEGRADED_WINDOW_MS) return 'degraded'
  return 'offline'
}

export function toDeviceView(device: Device, now: number): DeviceView {
  return { ...device, presence: derivePresence(device.lastSeenAt, now) }
}

export function formatLastSeen(lastSeenAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - lastSeenAt) / 1000))
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}

export function lastSeenLabel(lastSeenAt: number | undefined, now: number): string {
  return lastSeenAt ? formatLastSeen(lastSeenAt, now) : 'never'
}

export const PRESENCE_ORDER: Record<Presence, number> = {
  online: 0,
  degraded: 1,
  offline: 2,
}
