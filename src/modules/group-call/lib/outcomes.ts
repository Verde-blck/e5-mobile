import type { Delivery, Outcome, OutcomeStatus, Target } from '../types'

/**
 * One outcome per helmet that was sent to, in the order they were chosen. A helmet missing from the backend's
 * answer means it didn't take it for that helmet (for example it is no longer active), so that is a failure
 * rather than a silent gap.
 */
export function toOutcomes(targets: readonly Target[], deliveries: readonly Delivery[]): Outcome[] {
  const byId = new Map(deliveries.map((d) => [d.deviceId, d]))
  return targets.map((t) => {
    const d = byId.get(t.id)
    return { deviceId: t.id, deviceName: t.name, status: !d ? 'failed' : d.delivered ? 'sent' : 'queued' }
  })
}

/** The whole request failed (no connection, refused): every helmet is "not sent". */
export function allFailed(targets: readonly Target[]): Outcome[] {
  return targets.map((t) => ({ deviceId: t.id, deviceName: t.name, status: 'failed' as const }))
}

export function describeOutcome(status: OutcomeStatus): string {
  return status === 'sent' ? 'played' : status === 'queued' ? 'offline, will play when it reconnects' : 'not sent'
}

/** "2 played, 1 will play on reconnect, 1 not sent": the headline above the per-helmet list. */
export function summarize(outcomes: readonly Outcome[]): string {
  const count = (s: OutcomeStatus) => outcomes.filter((o) => o.status === s).length
  const parts = [
    count('sent') ? `${count('sent')} played` : '',
    count('queued') ? `${count('queued')} will play on reconnect` : '',
    count('failed') ? `${count('failed')} not sent` : '',
  ].filter(Boolean)
  return parts.join(', ')
}
