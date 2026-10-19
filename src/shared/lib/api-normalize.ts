/**
 * The helmet protocol sends everything as strings, and the API passes them
 * through unchanged. Rather than spread `Number(x)` across the codebase, every
 * response is normalised here at the module boundary — so the rest of the app
 * only ever sees real numbers, booleans and epoch timestamps.
 */

/** "83" → 83. Empty strings, null and unparseable values become undefined. */
export function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** The protocol's "1" / "0" flags. */
export function flag(value: unknown): boolean | undefined {
  if (value === null || value === undefined || value === '') return undefined
  return value === '1' || value === 1 || value === true
}

/** ISO 8601 → epoch milliseconds. The API sends "2026-09-18T16:20:40.079727Z". */
export function ts(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** Millivolts → volts. The helmet reports batteryVoltage as "3987". */
export function millivoltsToVolts(value: unknown): number | undefined {
  const mv = num(value)
  return mv === undefined ? undefined : mv / 1000
}

/** A Spring Data Page. Paginated endpoints wrap their results in this. */
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
  /** Chemical symbol as the helmet reports it — CH4, O2, CO, H2S… */
  gas: string
  value: number
}

/**
 * Parses the helmet's gas payload:
 *
 *   "CH4--0.0;O2--20.9;CO--0.0;H2S--0.0;NH3--;CH2O--;NO2--;SF6--;H2--;..."
 *
 * Twelve sensors are always listed; the ones this unit doesn't carry come back
 * with an empty value. Those are dropped rather than reported as zero — a
 * sensor that isn't fitted is not the same as a reading of nothing, and for
 * gas detection that distinction matters.
 */
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

/**
 * The API has no device name, only the IMEI. "866652022956404" becomes
 * "…56404", which an operator can at least recognise. Replace this the moment
 * the backend has real names.
 */
export function shortDeviceName(deviceId: string): string {
  return deviceId.length > 5 ? `…${deviceId.slice(-5)}` : deviceId
}
