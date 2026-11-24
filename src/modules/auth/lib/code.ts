export const CODE_LENGTH = 6

/** What a code box keeps of what was typed or pasted: digits only, at most six. */
export function cleanCode(typed: string): string {
  return typed.replace(/\D/g, '').slice(0, CODE_LENGTH)
}

export function isCompleteCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}
