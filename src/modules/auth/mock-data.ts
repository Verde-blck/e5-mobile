import { expandPermissions } from '@/shared/constants/backend-permissions'
import type { AuthUser } from '@/shared/store/authStore'
import { ALL_PERMISSIONS } from '@/shared/constants/modules'

export const mockAdmin: AuthUser = {
  id: 'user-1',
  username: 'ADM-001',
  name: 'VERDEblck',
  email: 'david@example.com',
  role: 'Super admin',
  superAdmin: true,
  permissions: ALL_PERMISSIONS,
  deviceIds: [],
  twoFactorEnabled: false,
  scope: { allSites: true, sites: [] },
}

export const mockOperator: AuthUser = {
  id: 'user-2',
  username: 'OP-014',
  name: 'Site Operator',
  email: 'operator@example.com',
  role: 'Monitoring',
  superAdmin: false,
  permissions: ['devices:read', 'map:read', 'alarms:read'],
  deviceIds: [],
  twoFactorEnabled: false,
  scope: { allSites: true, sites: [] },
}

export const mockViewer: AuthUser = {
  id: 'user-6',
  username: 'RO-001',
  name: 'Settings Viewer',
  role: 'Viewer',
  superAdmin: false,
  permissions: ['devices:read', 'map:read', 'alarms:read', 'unitSettings:read', 'wifi:read', 'fences:read', 'trackPlayback:read'],
  deviceIds: [],
  twoFactorEnabled: false,
  scope: { allSites: true, sites: [] },
}

const SUB_ADMIN_CODES = ['ADMINISTRATOR_SETTING', 'MONITORING_CENTER', 'ALARM_RECORD_MANAGE', 'FENCE']
export const mockSubAdmin: AuthUser = {
  id: 'user-7',
  username: 'AD-001',
  name: 'Site Admin',
  role: 'Site admin',
  superAdmin: false,
  permissions: expandPermissions(SUB_ADMIN_CODES) as AuthUser['permissions'],
  apiPermissions: SUB_ADMIN_CODES,
  deviceIds: [],
  twoFactorEnabled: false,
  scope: { allSites: true, sites: [] },
}

export const mockNewStarter: AuthUser = {
  id: 'user-5',
  username: 'NEW-001',
  name: 'Chidi Eze',
  role: 'Monitoring',
  superAdmin: false,
  permissions: ['devices:read', 'map:read', 'alarms:read'],
  deviceIds: [],
  twoFactorEnabled: false,
  mustChangePassword: true,
  scope: { allSites: true, sites: [] },
}

const twoFactor = new Map<string, boolean>([['MFA-001', true]])

export const mockSetupRequired: AuthUser = {
  id: 'user-6',
  username: 'SETUP-001',
  name: 'Ngozi Bello',
  role: 'Monitoring',
  superAdmin: false,
  permissions: ['devices:read', 'map:read', 'alarms:read'],
  deviceIds: [],
  twoFactorEnabled: false,
  mustSetup2fa: true,
  scope: { allSites: true, sites: [] },
}

let requireTwoFactor = false
export const mockRequire2fa = (): boolean => requireTwoFactor
export function setMockRequire2fa(on: boolean): void {
  requireTwoFactor = on
}

export function mockTwoFactorOn(username: string): boolean {
  return twoFactor.get(username.trim().toUpperCase()) ?? false
}

export function setMockTwoFactor(username: string, on: boolean): void {
  twoFactor.set(username.trim().toUpperCase(), on)
}

const passwordChanged = new Set<string>()

export function setMockPasswordChanged(username: string): void {
  passwordChanged.add(username.trim().toUpperCase())
}

export function mockUserFor(username: string): AuthUser {
  const id = username.trim().toUpperCase()
  const base = id.startsWith('OP')
    ? mockOperator
    : id.startsWith('AD') && !id.startsWith('ADM')
      ? mockSubAdmin
      : id.startsWith('RO')
        ? mockViewer
      : id.startsWith('NEW')
        ? mockNewStarter
        : id.startsWith('SETUP')
          ? mockSetupRequired
          : mockAdmin
  const on = mockTwoFactorOn(id)
  return { ...base, username: id || base.username, twoFactorEnabled: on, mustChangePassword: base.mustChangePassword === true && !passwordChanged.has(id), mustSetup2fa: (base.mustSetup2fa === true || requireTwoFactor) && !on }
}
