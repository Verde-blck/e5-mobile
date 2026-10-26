// Anything else is refused by the backend with 400 invalid_token, so it's caught here first.
export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(value)
}

export function isValidInstallId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value)
}
