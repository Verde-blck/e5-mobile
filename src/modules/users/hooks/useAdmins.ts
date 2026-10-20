import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isForbidden } from '@/shared/lib/errors'
import { useCan } from '@/shared/lib/permissions'
import { useAuthStore } from '@/shared/store/authStore'
import { createAdmin, createGroup, deleteAdmin, deleteGroup, fetchAdmins, fetchGroups, fetchPermissions, renameGroup, updateAdmin } from '../api/admins.api'
import type { AdministratorUpdate, NewAdministrator } from '../types'

const retry = (count: number, error: unknown) => !isForbidden(error) && count < 1

function useEnabled() {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  return signedIn && useCan('users:read')
}

export function useAdmins() {
  const enabled = useEnabled()
  const q = useQuery({ queryKey: ['admins'], queryFn: fetchAdmins, enabled, retry })
  return { admins: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch }
}

export function useGroups() {
  const enabled = useEnabled()
  const q = useQuery({ queryKey: ['groups'], queryFn: fetchGroups, enabled, retry })
  return { groups: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch }
}

/** The catalogue is fixed server-side, so it is asked for rarely. */
export function usePermissionCatalogue() {
  const enabled = useEnabled()
  return useQuery({ queryKey: ['permissions'], queryFn: fetchPermissions, enabled, staleTime: 60 * 60_000 }).data ?? []
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admins'] })
    void queryClient.invalidateQueries({ queryKey: ['groups'] })
  }
}

export function useCreateAdmin() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (input: NewAdministrator) => createAdmin(input), onSuccess: invalidate })
}
export function useUpdateAdmin() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: ({ id, patch }: { id: number; patch: AdministratorUpdate }) => updateAdmin(id, patch), onSuccess: invalidate })
}
export function useDeleteAdmin() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: number) => deleteAdmin(id), onSuccess: invalidate })
}
export function useCreateGroup() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (name: string) => createGroup(name), onSuccess: invalidate })
}
export function useRenameGroup() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: ({ id, name }: { id: number; name: string }) => renameGroup(id, name), onSuccess: invalidate })
}
export function useDeleteGroup() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: number) => deleteGroup(id), onSuccess: invalidate })
}
