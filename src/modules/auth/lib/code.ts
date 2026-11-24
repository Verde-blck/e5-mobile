import { errorReason, errorReference, statusOf } from '@/shared/lib/errors'

export const CODE_LENGTH = 6

/** What a code box keeps of what was typed or pasted: digits only, at most six. */
export function cleanCode(typed: string): string {
  return typed.replace(/\D/g, '').slice(0, CODE_LENGTH)
}

export function isCompleteCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

export interface CodeRefusal {
  message: string
  /** True when the pending sign-in is gone, so the password step has to be repeated before another code can work. */
  restart: boolean
}

/**
 * What to tell the person when a code is refused, from the backend's list of errors for the code step. Only `challenge_expired` means the pending
 * sign-in is gone. A wrong code leaves the same one working, and a code that was already used needs the next code, which comes every 30 seconds.
 */
export function codeRefusal(error: unknown): CodeRefusal {
  const status = statusOf(error)
  const reason = (errorReason(error) ?? '').toLowerCase()
  if (status === 429 || reason === 'too_many_attempts') return { message: 'Too many wrong codes. Wait 15 minutes and try again.', restart: false }
  if (status === 400 || status === 401) {
    if (reason === 'challenge_expired') return { message: 'That sign-in timed out, so a new one was started. Enter your code again.', restart: true }
    if (reason === 'code_already_used') return { message: 'That code was already used. Wait for the next one, which comes every 30 seconds, and try again.', restart: false }
    if (reason === 'invalid or expired code') return { message: "That code didn't work. Check your authenticator app, and that your phone's date and time are set to automatic, then try again.", restart: false }
    const reference = errorReference(error)
    return { message: `That code didn't work. Check your authenticator app and try again.${reference ? ` (Reference: ${reference})` : ''}`, restart: false }
  }
  if (status !== undefined && status >= 500) return { message: 'The server had a problem. Try again shortly.', restart: false }
  return { message: "Can't reach the server. Check your connection and try again.", restart: false }
}
