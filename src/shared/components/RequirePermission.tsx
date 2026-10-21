import type { ReactNode } from 'react'
import { Redirect } from 'expo-router'
import type { Permission } from '@/shared/constants/modules'
import { useCan } from '@/shared/lib/permissions'

/**
 * Renders its children only for an account holding `permission`; anyone else
 * is sent to `fallback`.
 *
 * Used on each screen rather than relying on hidden tabs alone, because a tab
 * that's merely hidden can still be reached by URL or as the landing screen.
 * Checking before the screen mounts also means a restricted account never
 * starts that screen's polling.
 */
export function RequirePermission({
  permission,
  or,
  fallback,
  children,
}: {
  permission: Permission
  /** A second permission that is also enough (for a screen two different roles use). */
  or?: Permission
  fallback: string
  children: ReactNode
}) {
  const first = useCan(permission)
  const second = useCan(or ?? permission)
  return first || second ? <>{children}</> : <Redirect href={fallback} />
}
