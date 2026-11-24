import { errorReference, statusOf } from '@/shared/lib/errors'

export const CODE_LENGTH = 6

/** What a code box keeps of what was typed or pasted: digits only, at most six. */
export function cleanCode(typed: string): string {
  return typed.replace(/\D/g, '').slice(0, CODE_LENGTH)
}

export function isCompleteCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

/**
 * What to tell the person when a code is refused, and whether to ask the server for a new login challenge before the next try. A 400 or 401 covers
 * a wrong code, an expired challenge and a challenge the server has already used, and the server answers all three the same way, so the
 * reference it gave is shown and a fresh challenge is fetched: a retry on the old one could never work.
 */
export function codeRefusal(error: unknown): { message: string; freshChallenge: boolean } {
  const status = statusOf(error)
  if (status === 400 || status === 401) {
    const reference = errorReference(error)
    return { message: `That code didn't work. Check your authenticator app and try again.${reference ? ` (Reference: ${reference})` : ''}`, freshChallenge: true }
  }
  if (status === 429) return { message: 'Too many attempts. Wait a minute and try again.', freshChallenge: false }
  if (status !== undefined && status >= 500) return { message: 'The server had a problem. Try again shortly.', freshChallenge: false }
  return { message: "Can't reach the server. Check your connection and try again.", freshChallenge: false }
}
