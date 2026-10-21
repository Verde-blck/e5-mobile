import { expandPermissions } from '@/shared/constants/backend-permissions'
import type { AuthUser } from '@/shared/store/authStore'
import { ALL_PERMISSIONS } from '@/shared/constants/modules'

// User fixtures for EXPO_PUBLIC_USE_MOCKS=true. Same accounts as the web
// dashboard's mock mode.

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

// A restricted account, like Cypher's "Viewer" test role. Sign in as OP-014 to
// see the tab bar drop to the screens that account may use.
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

// Can see the helmet settings and the site Wi-Fi but not change them (the backend's
// UNIT_SETTING without UNIT_SETTING_MANAGE). Sign in as RO-001.
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

// Administers accounts but is not a super admin: can't touch super admins, and can only grant what they hold.
// Sign in as AD-001.
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

// Sign in as NEW-001 to get a user flagged mustChangePassword. The mobile app
// doesn't act on the flag yet (the web dashboard blocks on a change-password
// screen; that arrives with the users/roles batch).
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

// MFA-001 is the account with two-step verification on. Switching it off in
// the security screen is remembered until the app restarts, so the whole
// on -> off -> on round trip can be exercised.
const twoFactor = new Map<string, boolean>([['MFA-001', true]])

// SETUP-001 is an account that has to set up two-step verification before it can use anything (the company requires it).
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

// The company policy "require two-step verification for everyone" (GET/PUT /api/settings/security).
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
  // Required by the company (or by this account's own flag), and not yet set up.
  return { ...base, username: id || base.username, twoFactorEnabled: on, mustSetup2fa: (base.mustSetup2fa === true || requireTwoFactor) && !on }
}
