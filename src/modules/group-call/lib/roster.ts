/** A recorded message: a sentence or two for the crew, not a speech. */
export const MAX_MESSAGE_SECONDS = 60

interface RosterDevice {
  id: string
  active: boolean
}

/**
 * The helmets a message can go to: chosen, and not deactivated. An offline helmet is kept (it is queued and plays
 * when it reconnects); a deactivated one isn't (the backend wouldn't take it).
 */
export function reachableDevices<T extends RosterDevice>(devices: readonly T[], roster: readonly string[]): T[] {
  const chosen = new Set(roster)
  return devices.filter((d) => chosen.has(d.id) && d.active)
}

export function toggleId(roster: readonly string[], id: string): string[] {
  return roster.includes(id) ? roster.filter((x) => x !== id) : [...roster, id]
}

/** "Send to 3" / "Send to 1": the button says exactly how many helmets will get it. */
export function sendLabel(count: number, sending: boolean): string {
  return sending ? 'Sending…' : `Send to ${count}`
}
