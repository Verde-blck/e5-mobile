import type { QueryClient } from '@tanstack/react-query'
import type { Alarm } from '../types'

export const ALARMS_KEY = ['alarms'] as const

export function upsertAlarm(list: readonly Alarm[], incoming: Alarm, now: number = Date.now()): Alarm[] {
  const index = list.findIndex((a) => a.id === incoming.id)
  if (index === -1) return [incoming, ...list]

  const previous = list[index]
  const resolvedNow = incoming.status === 'resolved' && previous.status === 'active'
  const merged: Alarm = {
    ...previous,
    ...incoming,
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
