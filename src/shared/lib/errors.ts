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

// A 403 carrying {"error":"forbidden"} is a permission refusal; a 403 without that body is how an expired
// token comes back. Telling them apart is what keeps a restricted account from being signed out.
export function isForbidden(error: unknown): boolean {
  return statusOf(error) === 403 && bodyOf(error)?.error === 'forbidden'
}

export function isSetupRequired(error: unknown): boolean {
  return statusOf(error) === 403 && bodyOf(error)?.error === '2fa_setup_required'
}

/** Thrown instead of sending a request when this build has no usable server address. */
export class ConfigProblemError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigProblemError'
  }
}

/** The status and the server's own short reason, such as "401 invalid_code", so a refusal can be told apart when someone quotes it. Empty when there was no reply. */
export function errorReference(error: unknown): string {
  const status = statusOf(error)
  if (status === undefined) return ''
  const body = bodyOf(error)
  const reason = [body?.error, body?.message, body?.code].find((v): v is string => typeof v === 'string' && v.trim().length > 0) ?? ''
  const tidy = reason.replace(/[^A-Za-z0-9_ .:-]/g, '').trim().slice(0, 40)
  return tidy ? `${status} ${tidy}` : String(status)
}

export function isConfigProblem(error: unknown): boolean {
  return error instanceof ConfigProblemError
}

export function isPasswordChangeRequired(error: unknown): boolean {
  return statusOf(error) === 403 && bodyOf(error)?.error === 'password_change_required'
}

export function missingPermission(error: unknown): string | undefined {
  const permission = bodyOf(error)?.permission
  return typeof permission === 'string' ? permission : undefined
}

export function serverError(error: unknown): { code?: string; message?: string } {
  const body = bodyOf(error)
  return {
    code: typeof body?.error === 'string' ? body.error : undefined,
    message: typeof body?.message === 'string' ? body.message : undefined,
  }
}
