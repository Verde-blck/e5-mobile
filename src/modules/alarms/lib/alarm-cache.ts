import type { QueryClient } from '@tanstack/react-query'
import type { Alarm } from '../types'

export const ALARMS_KEY = ['alarms'] as const

/**
 * Adds an alarm, or updates it if the list already has it.
 *
 * Used for both stream events: a new alarm is inserted; an update flips an
 * existing one between active and resolved. The list stays correct whether the
 * event or the next poll gets there first.
 */
export function upsertAlarm(list: readonly Alarm[], incoming: Alarm, now: number = Date.now()): Alarm[] {
  const index = list.findIndex((a) => a.id === incoming.id)
  if (index === -1) return [incoming, ...list]

  const previous = list[index]
  const resolvedNow = incoming.status === 'resolved' && previous.status === 'active'
  const merged: Alarm = {
    ...previous,
    ...incoming,
    // The API names no resolver and no time; keep what was recorded locally.
    resolvedAt:
      incoming.status === 'active' ? undefined : resolvedNow ? now : previous.resolvedAt,
    resolvedBy: incoming.status === 'active' ? undefined : previous.resolvedBy,
  }
  const next = [...list]
  next[index] = merged
  return next
}

export function applyAlarm(client: QueryClient, alarm: Alarm): void {
  client.setQueryData<Alarm[]>(ALARMS_KEY, (previous) => upsertAlarm(previous ?? [], alarm))
}
