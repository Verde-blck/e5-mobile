/** Joins class names, skipping the falsy ones: cn('p-4', isOn && 'bg-red-500'). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
