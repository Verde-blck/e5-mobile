/** A Wi-Fi network name is at most 32 *bytes*, so an accented or emoji name runs out sooner. */
export function validateSsid(value: string): string | null {
  const bytes = new TextEncoder().encode(value).length
  if (bytes === 0) return 'Enter the network name.'
  if (bytes > 32) return 'A network name can be at most 32 characters.'
  return null
}

/** Empty is allowed: it keeps the current password, or means an open network. */
export function validateWifiPassword(value: string): string | null {
  if (value === '') return null
  if (value.length < 8 || value.length > 63) return 'A Wi-Fi password is 8 to 63 characters.'
  return null
}

export function validateSplitMinutes(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 60) return 'Choose a whole number of minutes from 1 to 60.'
  return null
}
