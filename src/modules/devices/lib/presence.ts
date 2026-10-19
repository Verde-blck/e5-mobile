import type { Device, DeviceView, Presence } from '../types'

export const HEARTBEAT_MS = 30_000

/**
 * Matches the backend's own rule: a device is online if it reported in the
 * last two minutes.
 *
 * This used to be ninety seconds, chosen before the API existed. Keeping two
 * different definitions meant the dashboard's own summary count could
 * disagree with the dots in its own device list — the kind of contradiction
 * that makes an operator stop trusting the screen. The server owns the rule;
 * we follow it.
 */
export const ONLINE_WINDOW_MS = 120_000

/** Reported recently enough to be live, but not within the online window. */
export const DEGRADED_WINDOW_MS = 10 * 60_000

/**
 * A helmet on a SIM will drop routinely — cell handoff, a basement, a tunnel.
 * If "online" means "we hold an open socket" the alarm feed becomes noise
 * within a day and operators stop reading it. Presence is a function of time
 * since last contact instead.
 *
 * 'degraded' has no equivalent on the backend, which is binary. It sits
 * between the two so a helmet that has just slipped out of coverage reads
 * differently from one that has been dark for an hour.
 */
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

/** formatLastSeen, but for a helmet that has never connected (lastSeenAt 0). */
export function lastSeenLabel(lastSeenAt: number | undefined, now: number): string {
  return lastSeenAt ? formatLastSeen(lastSeenAt, now) : 'never'
}

/** Sort order for lists: live helmets first, dark ones last. */
export const PRESENCE_ORDER: Record<Presence, number> = {
  online: 0,
  degraded: 1,
  offline: 2,
}
