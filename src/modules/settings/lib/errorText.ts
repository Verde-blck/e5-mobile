import { isForbidden, statusOf } from '@/shared/lib/errors'

export function describeSettingsError(error: unknown): string {
  if (isForbidden(error)) return "Your role isn't allowed to do that."
  const status = statusOf(error)
  if (status === 404) return "The server couldn't find that helmet."
  if (status !== undefined && status >= 500) return 'The server had a problem. Try again shortly.'
  if (status !== undefined) return "That didn't go through."
  return "Can't reach the server. Check your connection and try again."
}
