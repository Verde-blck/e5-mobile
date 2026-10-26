import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { allPermissionCodes, type ApiPermission } from '@/shared/constants/backend-permissions'
import type { Administrator, AdministratorUpdate, Group, NewAdministrator } from '../types'
import { mockRequire2fa, setMockRequire2fa } from '@/modules/auth/mock-data'
import { createMockAdmin, createMockGroup, deleteMockAdmin, deleteMockGroup, getMockAdmins, getMockGroups, resetMockTwoFactor, updateMockAdmin, updateMockGroup } from './admins.mock'

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
  // The password is left out entirely rather than sent empty, so a blank
  // field can never overwrite a working password with nothing.
  const body = { ...patch }
  if (!body.password) delete body.password
  const { data } = await apiClient.put<Administrator>(`/admins/${id}`, body)
  return data
}

export async function deleteAdmin(id: number): Promise<void> {
  if (env.useMocks) return deleteMockAdmin(id)
  await apiClient.delete(`/admins/${id}`)
}

export async function fetchPermissions(): Promise<ApiPermission[]> {
  if (env.useMocks) return allPermissionCodes()
  try {
    const { data } = await apiClient.get<ApiPermission[]>('/permissions')
    return data?.length ? data : allPermissionCodes()
  } catch {
    return allPermissionCodes()
  }
}

export async function fetchGroups(): Promise<Group[]> {
  if (env.useMocks) return getMockGroups()
  const { data } = await apiClient.get<Group[]>('/groups')
  return data ?? []
}

export async function createGroup(name: string): Promise<Group> {
  if (env.useMocks) return createMockGroup(name)
  const { data } = await apiClient.post<Group>('/groups', { name })
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

export async function resetAdminTwoFactor(id: number): Promise<Administrator> {
  if (env.useMocks) return resetMockTwoFactor(id)
  const { data } = await apiClient.post<Administrator>(`/admins/${id}/2fa/reset`)
  return data
}

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
