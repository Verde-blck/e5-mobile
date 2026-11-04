export interface PasswordChangeInput {
  current: string
  next: string
  confirm: string
}

export type PasswordChangeErrors = Partial<Record<keyof PasswordChangeInput, string>>

export const MIN_PASSWORD_LENGTH = 8

/** What is wrong with the three fields, if anything: the same rules, in the same order, as the web dashboard's page. */
export function validatePasswordChange({ current, next, confirm }: PasswordChangeInput): PasswordChangeErrors {
  const errors: PasswordChangeErrors = {}
  if (!current) errors.current = 'Enter your current password'
  if (next.length < MIN_PASSWORD_LENGTH) errors.next = `Use at least ${MIN_PASSWORD_LENGTH} characters`
  if (!confirm) errors.confirm = 'Confirm your new password'
  // Comparing the fields only means something once each has been filled in properly.
  if (Object.keys(errors).length > 0) return errors
  if (next !== confirm) errors.confirm = "Those don't match"
  if (next === current) errors.next = 'Choose something different from your current password'
  return errors
}
