import { mockTwoFactorOn, setMockTwoFactor } from '@/modules/auth/mock-data'
import { viewCodeOf, type ApiPermission } from '@/shared/constants/backend-permissions'
import { useAuthStore } from '@/shared/store/authStore'
import type { Administrator, AdministratorUpdate, Group, NewAdministrator } from '../types'

// Sample-data twin of the administrators API. It enforces the same rules the backend does (Cypher, 20 Oct):
// you can't delete yourself (400), only a super admin edits or deletes a super admin (403), the last super
// admin can't be deleted (409 last_super_admin), you can't grant a code you don't hold (403 with the code),
// and an account name can only be used once (409).

const delay = () => new Promise((resolve) => setTimeout(resolve, 250))
const httpError = (status: number, data: object = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })
const me = () => useAuthStore.getState().user

let admins: Administrator[] = [
  { id: 1, username: 'ADM-001', role: 'Super admin', department: 'Operations', mobilePhone: '0803 000 0001', groupId: 1, permissions: [], deviceIds: [], superAdmin: true, twoFactorEnabled: false },
  { id: 2, username: 'AD-001', role: 'Site admin', department: 'HSE', mobilePhone: '0803 000 0002', groupId: 1, permissions: ['ADMINISTRATOR_SETTING', 'MONITORING_CENTER', 'ALARM_RECORD_MANAGE', 'FENCE'], deviceIds: [] },
  { id: 3, username: 'OP-014', role: 'Operator', department: 'Control room', mobilePhone: '0803 000 0014', groupId: 2, permissions: ['MONITORING_CENTER', 'ALARM_RECORD'], deviceIds: ['866652022956404', '866652022956412'] },
  { id: 4, username: 'RO-001', role: 'Viewer', department: 'Audit', mobilePhone: null, groupId: 99, permissions: ['MONITORING_CENTER', 'UNIT_SETTING', 'FENCE', 'TRACK_PLAYBACK'], deviceIds: [] },
  { id: 5, username: 'MFA-001', role: 'Operator', department: 'Control room', mobilePhone: '0803 000 0005', groupId: 2, permissions: ['MONITORING_CENTER', 'ALARM_RECORD'], deviceIds: [], twoFactorEnabled: true },
]
let groups: Group[] = [
  { id: 1, name: 'Head office', createdBy: 'ADM-001' },
  { id: 2, name: 'Rig crew', createdBy: 'ADM-001' },
]
let nextAdmin = 6
let nextGroup = 3

const copy = (a: Administrator): Administrator => ({ ...a, permissions: [...a.permissions], deviceIds: [...a.deviceIds] })

/** Whether the signed-in sample user holds a code (a _MANAGE code includes its view code). */
function holds(code: ApiPermission): boolean {
  const user = me()
  if (!user || user.superAdmin) return true
  const mine = new Set(user.apiPermissions ?? [])
  return mine.has(code) || (!code.endsWith('_MANAGE') && mine.has(`${code}_MANAGE` as ApiPermission))
}
const firstNotHeld = (codes: readonly ApiPermission[]) => codes.find((c) => !holds(c))

export async function getMockAdmins(): Promise<Administrator[]> {
  await delay()
  // Each account's two-step state is the one the sign-in uses, so setting it up, turning it off or resetting it shows here.
  admins = admins.map((a) => ({ ...a, twoFactorEnabled: mockTwoFactorOn(a.username) }))
  return admins.map(copy)
}

export async function createMockAdmin(input: NewAdministrator): Promise<Administrator> {
  await delay()
  if (admins.some((a) => a.username.toLowerCase() === input.username.toLowerCase())) throw httpError(409, { error: 'username_taken' })
  if (input.password.length < 6) throw httpError(400, { message: 'The password must be at least 6 characters' })
  const refused = firstNotHeld(input.permissions)
  if (refused) throw httpError(403, { error: 'forbidden', permission: refused })
  const { password: _password, ...rest } = input
  const created: Administrator = { id: nextAdmin++, ...rest, permissions: [...input.permissions], deviceIds: [...input.deviceIds], superAdmin: false, twoFactorEnabled: false }
  admins.push(created)
  return copy(created)
}

export async function updateMockAdmin(id: number, patch: AdministratorUpdate): Promise<Administrator> {
  await delay()
  const index = admins.findIndex((a) => a.id === id)
  if (index < 0) throw httpError(404)
  if (admins[index].superAdmin && !me()?.superAdmin) throw httpError(403, { error: 'forbidden' })
  if (patch.permissions) {
    const refused = firstNotHeld(patch.permissions.filter((c) => !admins[index].permissions.includes(c)))
    if (refused) throw httpError(403, { error: 'forbidden', permission: refused })
  }
  if (patch.password !== undefined && patch.password !== '' && patch.password.length < 6) throw httpError(400, { message: 'The password must be at least 6 characters' })
  const { password: _password, ...rest } = patch
  admins[index] = { ...admins[index], ...rest }
  return copy(admins[index])
}

export async function deleteMockAdmin(id: number): Promise<void> {
  await delay()
  const target = admins.find((a) => a.id === id)
  if (!target) throw httpError(404)
  if (target.username === me()?.username) throw httpError(400, { error: 'cannot_delete_self' })
  if (target.superAdmin && !me()?.superAdmin) throw httpError(403, { error: 'forbidden' })
  if (target.superAdmin && admins.filter((a) => a.superAdmin).length === 1) throw httpError(409, { error: 'last_super_admin' })
  admins = admins.filter((a) => a.id !== id)
}

/**
 * A lost or changed phone. Not your own account (400); only a super admin can reset a super admin (403). The person sets
 * 2FA up again at their next sign-in (and is forced to, if the company requires it).
 */
export async function resetMockTwoFactor(id: number): Promise<Administrator> {
  await delay()
  const target = admins.find((a) => a.id === id)
  if (!target) throw httpError(404)
  if (target.username === me()?.username) throw httpError(400, { error: 'cannot_reset_self' })
  if (target.superAdmin && !me()?.superAdmin) throw httpError(403, { error: 'forbidden' })
  setMockTwoFactor(target.username, false)
  return copy({ ...target, twoFactorEnabled: false })
}

export async function getMockGroups(): Promise<Group[]> {
  await delay()
  return groups.map((g) => ({ ...g }))
}
export async function createMockGroup(name: string): Promise<Group> {
  await delay()
  const created = { id: nextGroup++, name, createdBy: me()?.username ?? null }
  groups.push(created)
  return { ...created }
}
export async function updateMockGroup(id: number, name: string): Promise<Group> {
  await delay()
  const found = groups.find((g) => g.id === id)
  if (!found) throw httpError(404)
  found.name = name
  return { ...found }
}
export async function deleteMockGroup(id: number): Promise<void> {
  await delay()
  groups = groups.filter((g) => g.id !== id)
}

// An area counts once whether it is held as view or manage.
export const areaOf = viewCodeOf
