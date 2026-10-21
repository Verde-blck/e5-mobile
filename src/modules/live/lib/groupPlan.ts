/** The backend's limit per group call. */
export const GROUP_CALL_MAX = 8

export type CallPlan =
  | { kind: 'single'; deviceId: string }
  | { kind: 'group'; deviceIds: string[] }
  | { kind: 'none'; reason: string }

/**
 * What starting a call from the chosen helmets does, and who may.
 *
 * One helmet is the one-to-one call (needs live management); two or more is a group call (needs group call, the
 * backend's GROUP_CALL, as in the web). An account with only group call can still call a single helmet as a group of
 * one. Never more than the backend's limit.
 */
export function callPlan(selected: readonly string[], can: { single: boolean; group: boolean }): CallPlan {
  if (selected.length === 0) return { kind: 'none', reason: 'Select at least one active helmet.' }
  if (selected.length > GROUP_CALL_MAX) return { kind: 'none', reason: `A call can include up to ${GROUP_CALL_MAX} helmets. Deselect ${selected.length - GROUP_CALL_MAX}.` }
  if (selected.length === 1 && can.single) return { kind: 'single', deviceId: selected[0] }
  if (can.group) return { kind: 'group', deviceIds: [...selected] }
  if (selected.length === 1) return { kind: 'none', reason: "This account can't place calls." }
  return { kind: 'none', reason: "This account can't start a group call (the backend's GROUP_CALL permission)." }
}

/** Tick a helmet, or untick it. A deactivated helmet can't join a call, so it can't be ticked. */
export function toggleChosen(selected: readonly string[], device: { id: string; active: boolean }): string[] {
  if (selected.includes(device.id)) return selected.filter((id) => id !== device.id)
  return device.active ? [...selected, device.id] : [...selected]
}
