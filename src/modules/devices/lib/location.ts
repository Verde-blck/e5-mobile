import type { SimStatus, Telemetry } from '../types'

export function formatMeters(meters: number): string {
  return meters < 10 ? meters.toFixed(1) : String(Math.round(meters))
}

/**
 * How trustworthy a helmet's position is. Indoors a helmet has no GPS and its
 * "location" is worked out from the mobile network or Wi-Fi, which can be
 * hundreds of metres out — it must read as approximate, never as a pin.
 */
export function describeFix(t: Pick<Telemetry, 'fixType' | 'accuracyMeters'>): {
  label: string
  approximate: boolean
} | null {
  if (!t.fixType) return null
  const radius = t.accuracyMeters !== undefined ? ` · ±${formatMeters(t.accuracyMeters)} m` : ''
  switch (t.fixType) {
    case 'gps':
      return { label: `GPS${radius}`, approximate: false }
    case 'network':
      return { label: `Mobile network${radius}`, approximate: true }
    case 'wifi':
      return { label: `Wi-Fi${radius}`, approximate: true }
    default:
      return { label: `Other source${radius}`, approximate: true }
  }
}

export function gpsLevelLabel(level: number | undefined): string | null {
  if (level === undefined) return null
  return level >= 1 ? 'Strong' : level === 0 ? 'Weak' : 'No GPS signal'
}

export function simLabel(status: SimStatus | undefined): string {
  return status === 1 ? 'SIM present' : status === 2 ? 'No SIM' : 'Unknown'
}

export function networkLabel(networkType: string | undefined): string | null {
  if (!networkType) return null
  return networkType === 'wifi' ? 'Wi-Fi' : networkType.toUpperCase()
}
