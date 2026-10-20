import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { decodeToken, tokenStore } from '@/shared/lib/token'
import { storage } from '@/shared/lib/storage'
import { isForbidden, statusOf } from '@/shared/lib/errors'
import { expandPermissions } from '@/shared/constants/backend-permissions'
import { ALL_PERMISSIONS } from '@/shared/constants/modules'
import { withTimeout } from '@/shared/lib/withTimeout'
import type { AuthUser } from '@/shared/store/authStore'
import { mockTwoFactorOn, mockUserFor, setMockTwoFactor } from '../mock-data'

export { statusOf }

export interface Credentials {
  username: string
  password: string
}

// ---------------------------------------------------------------------------
// The signed-in profile — GET /api/auth/me
// ---------------------------------------------------------------------------

/**
 * What GET /api/auth/me returns. The login response and the 2FA verify
 * response carry the same profile, but the app always asks /auth/me instead
 * of depending on those shapes: one request, one definition, and it's what
 * restores a session after the app restarts.
 *
 * Permissions are re-read by the server on every request, so a role change
 * takes effect immediately — and this profile is only ever a *display* of
 * them. The server is what enforces.
 */
interface ApiProfile {
  username?: string
  roleName?: string | null
  /** true = full access; `permissions` is ignored. */
  superAdmin?: boolean
  permissions?: string[]
  /** The helmets this account is limited to. Empty = every helmet. */
  deviceIds?: string[]
  twoFactorEnabled?: boolean
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
    permissions: superAdmin ? ALL_PERMISSIONS : expandPermissions(profile.permissions ?? []),
    deviceIds: profile.deviceIds ?? [],
    twoFactorEnabled: profile.twoFactorEnabled === true,
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

/**
 * Stores the token and fetches the profile. If the profile can't be loaded
 * the token is dropped again, so a failed sign-in never leaves the phone
 * half signed-in.
 */
async function startSession(token: string, username: string): Promise<AuthUser> {
  await tokenStore.set(token)
  try {
    return await loadProfile(username)
  } catch (error) {
    await tokenStore.clear()
    throw error
  }
}

/** Re-reads the profile, e.g. after switching 2FA on or off. */
export async function refreshProfile(username: string): Promise<AuthUser> {
  if (env.useMocks) return mockUserFor(username)
  return loadProfile(username)
}

// ---------------------------------------------------------------------------
// Sign-in, including the optional second step
// ---------------------------------------------------------------------------

/** What the second sign-in step needs to carry forward from the first. */
export interface TwoFactorChallenge {
  username: string
  /**
   * One-time token proving the password step succeeded. The backend doesn't
   * issue one yet; it is passed through whenever it's present, so nothing here
   * changes when it arrives.
   */
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

/** The code the mock 2FA account always accepts. */
const MOCK_CODE = '123456'

/**
 * Step one. Resolves either with a signed-in user, or with a challenge when
 * the account has 2FA on, in which case the caller asks for a code and then
 * calls verifyTwoFactorLogin. No token is stored until that succeeds.
 */
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

/**
 * Step two: the 6-digit code from the authenticator app. A wrong or expired
 * code comes back as a 401.
 */
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

// ---------------------------------------------------------------------------
// Managing 2FA from the account security screen
// ---------------------------------------------------------------------------

export interface TwoFactorSetup {
  /** Base32 key, for pasting into an authenticator app. */
  secret: string
  /** otpauth:// URL. On a phone this opens the authenticator app directly. */
  otpAuthUrl: string
}

/**
 * Generates a new secret. 2FA is not on yet: it only switches on when
 * confirmTwoFactorSetup succeeds, which proves the app was set up correctly.
 */
export async function startTwoFactorSetup(username: string): Promise<TwoFactorSetup> {
  if (env.useMocks) {
    await delay(400)
    const secret = 'JBSWY3DPEHPK3PXP'
    const label = encodeURIComponent(`E5 Energy:${username}`)
    return {
      secret,
      otpAuthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=E5%20Energy`,
    }
  }

  const { data } = await apiClient.post<TwoFactorSetup>('/auth/2fa/setup')
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

/**
 * Sends the current code even though the backend doesn't check it yet. It's
 * been asked to, so that someone holding an unattended, signed-in phone can't
 * switch 2FA off; collecting it in the UI now means nothing changes then.
 */
export async function disableTwoFactor(username: string, code: string): Promise<void> {
  if (env.useMocks) {
    await delay(400)
    if (code !== MOCK_CODE) throw httpError(401)
    setMockTwoFactor(username, false)
    return
  }
  await apiClient.post('/auth/2fa/disable', { code })
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * Restores a session on launch: loads the saved token into memory, then asks
 * the server who it belongs to.
 *
 * - Token rejected (401, or a 403 that isn't a permission refusal) → the
 *   session is dead; returns null and forgets the token.
 * - Server unreachable → keeps the token and falls back to the last profile
 *   this phone saw, so the app still opens on a site with no signal. If there
 *   isn't one, returns null but keeps the token for the next launch.
 */
const RESTORE_TIMEOUT_MS = 6000

export async function restoreSession(): Promise<AuthUser | null> {
  const token = await tokenStore.load()
  if (!token) return null

  const username = decodeToken(token)?.sub ?? 'unknown'
  try {
    // The splash screen waits for this. On a dead network the request could take its full 20 s timeout;
    // after 6 s the saved profile is used instead, and the app carries on.
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

/**
 * There is no logout endpoint, so this only clears the phone. The token stays
 * valid at the server for the rest of its 24 hours — worth asking the backend
 * for a revocation endpoint, especially for a device that can be lost.
 */
export async function clearSession(): Promise<void> {
  await tokenStore.clear()
  await storage.remove(PROFILE_KEY)
}

// ---------------------------------------------------------------------------

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Shaped like an Axios error, so callers handle mocks and live the same way. */
function httpError(status: number) {
  const error = new Error(`HTTP ${status}`) as Error & { response?: { status: number } }
  error.response = { status }
  return error
}

/**
 * Turns a failed sign-in or code check into a sentence for the screen.
 * `wrongInput` is what a 401 means in context ("wrong password" vs "wrong code").
 */
export function describeAuthError(error: unknown, wrongInput: string): string {
  const status = statusOf(error)
  if (status === 401 || status === 400) return wrongInput
  if (status === 429) return 'Too many attempts. Wait a minute and try again.'
  if (status !== undefined && status >= 500) return 'The server had a problem. Try again shortly.'
  // No response at all: offline, DNS, timeout.
  return "Can't reach the server. Check your connection and try again."
}
