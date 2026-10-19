/** Reads the HTTP status off an Axios (or mock) error, if there is one. */
export function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null
    ? (error as { response?: { status?: number } }).response?.status
    : undefined
}

function bodyOf(error: unknown): Record<string, unknown> | null {
  const data =
    typeof error === 'object' && error !== null
      ? (error as { response?: { data?: unknown } }).response?.data
      : undefined
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
}

/**
 * A 403 the server sent on purpose: "you are signed in, but not allowed to do
 * this". The backend marks these with {"error":"forbidden"} and names the
 * missing permission (or the helmet outside the account's list).
 *
 * That is NOT the same as a 403 for an expired token, which has no such body.
 * Telling them apart is what keeps a restricted account from being signed out
 * every time it taps something it isn't allowed to use.
 */
export function isForbidden(error: unknown): boolean {
  return statusOf(error) === 403 && bodyOf(error)?.error === 'forbidden'
}

/** The permission code the server says is missing, e.g. "PHOTO_RECORD". */
export function missingPermission(error: unknown): string | undefined {
  const permission = bodyOf(error)?.permission
  return typeof permission === 'string' ? permission : undefined
}
