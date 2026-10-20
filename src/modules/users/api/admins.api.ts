import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { allPermissionCodes, type ApiPermission } from '@/shared/constants/backend-permissions'
import type { Administrator, AdministratorUpdate, Group, NewAdministrator } from '../types'
import { createMockAdmin, createMockGroup, deleteMockAdmin, deleteMockGroup, getMockAdmins, getMockGroups, updateMockAdmin, updateMockGroup } from './admins.mock'

// Administrators. Creating one here is the supported path, unlike POST /api/auth/register, which is
// unauthenticated and not for staff accounts.

export async function fetchAdmins(): Promise<Administrator[]> {
  if (env.useMocks) return getMockAdmins()
  const { data } = await apiClient.get<Administrator[]>('/admins')
  return data ?? []
}

export async function createAdmin(input: NewAdministrator): Promise<Administrator> {
  if (env.useMocks) return createMockAdmin(input)
  const { data } = await apiClient.post<Administrator>('/admins', input)
  return data
}

export async function updateAdmin(id: number, patch: AdministratorUpdate): Promise<Administrator> {
  if (env.useMocks) return updateMockAdmin(id, patch)
  // The password is left out entirely rather than sent empty, so a blank field can never overwrite a
  // working password with nothing.
  const body = { ...patch }
  if (!body.password) delete body.password
  const { data } = await apiClient.put<Administrator>(`/admins/${id}`, body)
  return data
}

/**
 * Needs ADMINISTRATOR_SETTING. The account's token then gets 401 on its very next request, and its push
 * registrations are removed. Refused for yourself (400), for a super admin unless you are one (403), and
 * for the last super admin (409 last_super_admin).
 */
export async function deleteAdmin(id: number): Promise<void> {
  if (env.useMocks) return deleteMockAdmin(id)
  await apiClient.delete(`/admins/${id}`)
}

/** The permission catalogue is served by the backend; the local list is the fallback for mock mode and a failed request. */
export async function fetchPermissions(): Promise<ApiPermission[]> {
  if (env.useMocks) return allPermissionCodes()
  try {
    const { data } = await apiClient.get<ApiPermission[]>('/permissions')
    return data?.length ? data : allPermissionCodes()
  } catch {
    return allPermissionCodes()
  }
}

// ---- groups -------------------------------------------------------------------------------------------

export async function fetchGroups(): Promise<Group[]> {
  if (env.useMocks) return getMockGroups()
  const { data } = await apiClient.get<Group[]>('/groups')
  return data ?? []
}

export async function createGroup(name: string): Promise<Group> {
  if (env.useMocks) return createMockGroup(name)
  const { data } = await apiClient.post<Group>('/groups', { name }) // createdBy comes from the session
  return data
}

export async function renameGroup(id: number, name: string): Promise<Group> {
  if (env.useMocks) return updateMockGroup(id, name)
  const { data } = await apiClient.put<Group>(`/groups/${id}`, { name })
  return data
}

export async function deleteGroup(id: number): Promise<void> {
  if (env.useMocks) return deleteMockGroup(id)
  await apiClient.delete(`/groups/${id}`)
}
