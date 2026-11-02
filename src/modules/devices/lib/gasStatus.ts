import type { GasStatus } from '@/shared/lib/api-normalize'

/** "less than a minute ago", "5 min ago", "2 h ago", "3 d ago". */
export function gasAgeLabel(ageSeconds: number): string {
  const seconds = Math.max(0, Math.floor(ageSeconds))
  if (seconds < 60) return 'less than a minute ago'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

export interface GasFreshness {
  offline: boolean
  /** The line to show instead of "Taken ..." when the reading is not current. */
  label: string | null
}

/**
 * A reading is shown as current unless the server says it is not: only live === false makes it "offline", so a missing or failed
 * status request never hides a real reading behind a false "Offline".
 */
export function gasFreshness(status: GasStatus | undefined, gasAt: number | undefined, now: number): GasFreshness {
  if (status?.live !== false) return { offline: false, label: null }
  const age = status.ageSeconds ?? (gasAt ? (now - gasAt) / 1000 : undefined)
  return { offline: true, label: age === undefined ? 'Offline \u2013 time of last reading unknown' : `Offline \u2013 last reading ${gasAgeLabel(age)}` }
}
