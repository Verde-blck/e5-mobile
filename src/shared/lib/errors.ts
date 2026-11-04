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
