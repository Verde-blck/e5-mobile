import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { decodeToken, tokenStore } from '@/shared/lib/token'
import { storage } from '@/shared/lib/storage'
import { isForbidden, statusOf } from '@/shared/lib/errors'
import { expandPermissions } from '@/shared/constants/backend-permissions'
import { ALL_PERMISSIONS, type Permission } from '@/shared/constants/modules'
import { withTimeout } from '@/shared/lib/withTimeout'
import type { AuthUser } from '@/shared/store/authStore'
import { mockTwoFactorOn, mockUserFor, setMockTwoFactor, mockRequire2fa } from '../mock-data'

export { statusOf }

export interface Credentials {
  username: string
  password: string
}

// The login and 2FA responses carry the same profile, but the app always asks /auth/me:
// one request, one definition, and it is what restores a session after a restart.
interface ApiProfile {
  username?: string
  roleName?: string | null
  superAdmin?: boolean
  permissions?: string[]
  deviceIds?: string[]
  twoFactorEnabled?: boolean
  mustSetup2fa?: boolean
}

export function userFromProfile(profile: ApiProfile, fallbackUsername: string): AuthUser {
  const username = profile.username ?? fallbackUsername
  const superAdmin = profile.superAdmin === true
  return {
    id: username,
    username,
    name: username,
    role: superAdmin ? 'Super admin' : (profile.roleName ?? 'No role'),
    superAdmin,
    permissions: superAdmin ? ALL_PERMISSIONS : (expandPermissions(profile.permissions ?? []) as Permission[]),
    apiPermissions: profile.permissions ?? [],
    deviceIds: profile.deviceIds ?? [],
    twoFactorEnabled: profile.twoFactorEnabled === true,
    mustSetup2fa: profile.mustSetup2fa === true,
    scope: { allSites: true, sites: [] },
  }
}

const PROFILE_KEY = 'e5.profile'

async function cacheProfile(user: AuthUser): Promise<void> {
  try {
    await storage.set(PROFILE_KEY, JSON.stringify(user))
  } catch {
    // Only an offline fallback; losing it costs nothing but that fallback.
  }
}

async function readCachedProfile(): Promise<AuthUser | null> {
  try {
    const raw = await storage.get(PROFILE_KEY)
    const parsed = raw ? (JSON.parse(raw) as AuthUser) : null
    return parsed && typeof parsed.username === 'string' && Array.isArray(parsed.permissions)
      ? parsed
      : null
  } catch {
    return null
  }
}

async function loadProfile(fallbackUsername: string): Promise<AuthUser> {
  const { data } = await apiClient.get<ApiProfile>('/auth/me')
  const user = userFromProfile(data ?? {}, fallbackUsername)
  await cacheProfile(user)
  return user
}

// If the profile can't be loaded the token is dropped again, so a
// failed sign-in never leaves the phone half signed-in.
async function startSession(token: string, username: string): Promise<AuthUser> {
  await tokenStore.set(token)
  try {
    return await loadProfile(username)
  } catch (error) {
    await tokenStore.clear()
    throw error
  }
}

export async function refreshProfile(username: string): Promise<AuthUser> {
  if (env.useMocks) return mockUserFor(username)
  return loadProfile(username)
}

export interface TwoFactorChallenge {
  username: string
  // The backend doesn't issue one yet; it is passed through whenever
  // it's present, so nothing here changes when it arrives.
  mfaToken?: string
}

export type LoginResult =
  | { status: 'signed-in'; user: AuthUser }
  | { status: 'needs-code'; challenge: TwoFactorChallenge }

interface LoginResponse {
  token?: string
  requires2fa?: boolean
  mfaToken?: string
  challengeToken?: string
}

const MOCK_CODE = '123456'

export async function login(credentials: Credentials): Promise<LoginResult> {
  if (env.useMocks) {
    await delay(300)
    if (mockTwoFactorOn(credentials.username)) {
      return {
        status: 'needs-code',
        challenge: { username: credentials.username.trim().toUpperCase() },
      }
    }
    return { status: 'signed-in', user: mockUserFor(credentials.username) }
  }

  const { data } = await apiClient.post<LoginResponse>('/auth/login', credentials)

  if (data.requires2fa) {
    return {
      status: 'needs-code',
      challenge: {
        username: credentials.username,
        mfaToken: data.mfaToken ?? data.challengeToken,
      },
    }
  }

  if (!data.token) throw new Error('Sign-in response contained no token')
  return { status: 'signed-in', user: await startSession(data.token, credentials.username) }
}

export async function verifyTwoFactorLogin(
  challenge: TwoFactorChallenge,
  code: string
): Promise<AuthUser> {
  if (env.useMocks) {
    await delay(400)
    if (code !== MOCK_CODE) throw httpError(401)
    return mockUserFor(challenge.username)
  }

  const { data } = await apiClient.post<{ token: string }>('/auth/login/verify-2fa', {
    username: challenge.username,
    code,
    ...(challenge.mfaToken ? { mfaToken: challenge.mfaToken } : {}),
  })
  return startSession(data.token, challenge.username)
}

export interface TwoFactorSetup {
  secret: string
  otpAuthUrl: string
}

// With 2FA already on, moving to a new phone needs the CURRENT code, so
// someone holding an unattended signed-in phone can't swap it for their own.
export async function startTwoFactorSetup(username: string, currentCode?: string): Promise<TwoFactorSetup> {
  if (env.useMocks) {
    await delay(400)
    if (mockTwoFactorOn(username)) {
      if (!currentCode) throw httpError(409, { error: '2fa_already_enabled' })
      if (currentCode !== MOCK_CODE) throw httpError(401)
    }
    const secret = 'JBSWY3DPEHPK3PXP'
    const label = encodeURIComponent(`E5 Energy:${username}`)
    return {
      secret,
      otpAuthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=E5%20Energy`,
    }
  }

  const { data } = await apiClient.post<TwoFactorSetup>('/auth/2fa/setup', currentCode ? { code: currentCode } : undefined)
  return data
}

export async function confirmTwoFactorSetup(username: string, code: string): Promise<void> {
  if (env.useMocks) {
    await delay(400)
    if (code !== MOCK_CODE) throw httpError(401)
    setMockTwoFactor(username, true)
    return
  }
  await apiClient.post('/auth/2fa/confirm', { code })
}

export async function disableTwoFactor(username: string, code: string): Promise<void> {
  if (env.useMocks) {
    await delay(400)
    if (mockRequire2fa()) throw httpError(409, { error: '2fa_required_by_company' })
    if (code !== MOCK_CODE) throw httpError(401)
    setMockTwoFactor(username, false)
    return
  }
  await apiClient.post('/auth/2fa/disable', { code })
}

// A 401 (or a 403 that isn't a permission refusal) means the token is dead. With no
// signal the saved profile is used, so the app still opens on a site with no coverage.
const RESTORE_TIMEOUT_MS = 6000

export async function restoreSession(): Promise<AuthUser | null> {
  const token = await tokenStore.load()
  if (!token) return null

  const username = decodeToken(token)?.sub ?? 'unknown'
  try {
    return await withTimeout(loadProfile(username), RESTORE_TIMEOUT_MS)
  } catch (error) {
    const status = statusOf(error)
    if (status === 401 || (status === 403 && !isForbidden(error))) {
      await clearSession()
      return null
    }
    const cached = await readCachedProfile()
    return cached && cached.username === username ? cached : null
  }
}

// There is no logout endpoint, so this only clears the phone: the
// token stays valid at the server for the rest of its 24 hours.
export async function clearSession(): Promise<void> {
  await tokenStore.clear()
  await storage.remove(PROFILE_KEY)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function httpError(status: number, data?: { error: string }) {
  const error = new Error(`HTTP ${status}`) as Error & { response?: { status: number; data?: { error: string } } }
  error.response = { status, data }
  return error
}

export function describeTwoFactorError(error: unknown, wrongInput: string): string {
  const body = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
  if (statusOf(error) === 409 && body === '2fa_already_enabled') return 'Two-step verification is already on. Enter your current code to move it to a new phone.'
  if (statusOf(error) === 409 && body === '2fa_required_by_company') return "Your company requires two-step verification, so it can't be turned off."
  return describeAuthError(error, wrongInput)
}

export function describeAuthError(error: unknown, wrongInput: string): string {
  const status = statusOf(error)
  if (status === 401 || status === 400) return wrongInput
  if (status === 429) return 'Too many attempts. Wait a minute and try again.'
  if (status !== undefined && status >= 500) return 'The server had a problem. Try again shortly.'
  return "Can't reach the server. Check your connection and try again."
}
