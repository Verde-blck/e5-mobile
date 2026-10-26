import type { Permission } from '@/shared/constants/modules'
import { useAuthStore } from '@/shared/store/authStore'

export function useCan(permission: Permission): boolean {
  return useAuthStore((s) => s.user?.permissions.includes(permission) ?? false)
}
