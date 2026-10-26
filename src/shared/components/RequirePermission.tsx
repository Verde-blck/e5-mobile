import type { ReactNode } from 'react'
import { Redirect } from 'expo-router'
import type { Permission } from '@/shared/constants/modules'
import { useCan } from '@/shared/lib/permissions'

// Used on each screen rather than relying on hidden tabs alone, because a tab
// that's merely hidden can still be reached by URL or as the landing screen.
export function RequirePermission({
  permission,
  or,
  fallback,
  children,
}: {
  permission: Permission
  or?: Permission
  fallback: string
  children: ReactNode
}) {
  const first = useCan(permission)
  const second = useCan(or ?? permission)
  return first || second ? <>{children}</> : <Redirect href={fallback} />
}
