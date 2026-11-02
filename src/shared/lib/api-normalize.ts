// Rather than spread `Number(x)` across the codebase, every response is normalised here at the module
// boundary, so the rest of the app only ever sees real numbers, booleans and epoch timestamps.

export function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function flag(value: unknown): boolean | undefined {
  if (value === null || value === undefined || value === '') return undefined
  return value === '1' || value === 1 || value === true
}

// A helmet itself comes with `worn`, and its raw code must not be read:
// this app used to treat "1" as worn, which was the wrong way round.
export function wornFromWearCode(value: unknown): boolean | undefined {
  if (value === 2 || value === '2') return true
  if (value === 1 || value === '1') return false
  return undefined
}

export function ts(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

export function millivoltsToVolts(value: unknown): number | undefined {
  const mv = num(value)
  return mv === undefined ? undefined : mv / 1000
}

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  last: boolean
  first: boolean
  empty: boolean
}

export function pageContent<T>(page: Page<T> | T[] | null | undefined): T[] {
  if (!page) return []
  return Array.isArray(page) ? page : (page.content ?? [])
}

export interface GasReading {
  gas: string
  value: number
}

// Sensors a unit doesn't carry come back with an empty value and are dropped rather than reported as zero: a sensor
// that isn't fitted is not the same as a reading of nothing, and for gas detection that difference matters.
export function parseGasData(raw: unknown): GasReading[] {
  if (typeof raw !== 'string' || !raw) return []

  return raw
    .split(';')
    .map((entry) => {
      const [gas, value] = entry.split('--')
      if (!gas || value === undefined || value === '') return null
      const parsed = num(value)
      return parsed === undefined ? null : { gas: gas.trim(), value: parsed }
    })
    .filter((r): r is GasReading => r !== null)
}

/** Whether the helmet's gas reading is current: the three liveness fields of GET /api/devices/{id}/gas. */
export interface GasStatus {
  online?: boolean
  ageSeconds?: number
  live?: boolean
}

// Unlike flag(), which reads the helmet protocol's 1/0 codes and counts anything else as false, a missing or odd value stays unknown here.
function bool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true') return true
    if (v === 'false') return false
  }
  return undefined
}

// Anything that isn't clearly there is left undefined. "Offline" is only ever claimed when the server says live is false, never inferred from a missing field.
export function parseGasStatus(raw: unknown): GasStatus | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  const age = num(r.ageSeconds)
  const status: GasStatus = { online: bool(r.online), ageSeconds: age !== undefined && age >= 0 ? age : undefined, live: bool(r.live) }
  return status.online === undefined && status.ageSeconds === undefined && status.live === undefined ? undefined : status
}

// The API has no device name, only the IMEI, so it is shortened to
// its last digits, which an operator can at least recognise.
export function shortDeviceName(deviceId: string): string {
  return deviceId.length > 5 ? `…${deviceId.slice(-5)}` : deviceId
}
