import type { Permission } from '@/shared/constants/modules'
import { useAuthStore } from '@/shared/store/authStore'

/** True when the signed-in user holds the permission. */
export function useCan(permission: Permission): boolean {
  return useAuthStore((s) => s.user?.permissions.includes(permission) ?? false)
}
