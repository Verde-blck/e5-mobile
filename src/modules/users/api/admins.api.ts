import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { allPermissionCodes, type ApiPermission } from '@/shared/constants/backend-permissions'
import type { Administrator, AdministratorUpdate, Group, NewAdministrator } from '../types'
import { mockRequire2fa, setMockRequire2fa } from '@/modules/auth/mock-data'
import { createMockAdmin, createMockGroup, deleteMockAdmin, deleteMockGroup, getMockAdmins, getMockGroups, resetMockTwoFactor, updateMockAdmin, updateMockGroup } from './admins.mock'

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

/**
 * Lost or changed phone: clears the person's two-step verification so they set it up again at their next sign-in (forced, if the
 * company requires it). Needs ADMINISTRATOR_SETTING. Refused for your own account (400) and, unless you are a super admin, for a
 * super admin (403).
 */
export async function resetAdminTwoFactor(id: number): Promise<Administrator> {
  if (env.useMocks) return resetMockTwoFactor(id)
  const { data } = await apiClient.post<Administrator>(`/admins/${id}/2fa/reset`)
  return data
}

/** The company policy: must everyone use two-step verification? (GET and PUT /api/settings/security, ADMINISTRATOR_SETTING.) */
export async function fetchSecurityPolicy(): Promise<{ require2fa: boolean }> {
  if (env.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    return { require2fa: mockRequire2fa() }
  }
  const { data } = await apiClient.get<{ require2fa?: boolean }>('/settings/security')
  return { require2fa: data?.require2fa === true }
}

export async function setSecurityPolicy(require2fa: boolean): Promise<{ require2fa: boolean }> {
  if (env.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    setMockRequire2fa(require2fa)
    return { require2fa }
  }
  const { data } = await apiClient.put<{ require2fa?: boolean }>('/settings/security', { require2fa })
  return { require2fa: data?.require2fa === true }
}
