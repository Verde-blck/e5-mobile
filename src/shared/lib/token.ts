import { storage } from './storage'

const STORAGE_KEY = 'authToken'

interface JwtPayload {
  sub?: string
  exp?: number
  iat?: number
}

/**
 * Reads a JWT's payload without verifying it.
 *
 * Verification is the server's job — this is only used to recover the
 * username and expiry after the app restarts, because the API has no /auth/me
 * endpoint to ask. Never treat anything in here as trustworthy.
 */
export function decodeToken(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(padded)) as JwtPayload
  } catch {
    return null
  }
}

export function isExpired(token: string, skewMs = 30_000): boolean {
  const exp = decodeToken(token)?.exp
  if (!exp) return false // no expiry claim — let the server decide
  // Treat a token that's about to expire as already expired, so a request
  // doesn't set off mid-flight and come back 401.
  return Date.now() + skewMs >= exp * 1000
}

/**
 * Secure storage is asynchronous, but the axios request interceptor has to
 * read the token synchronously. So the token is mirrored in memory: `load()`
 * fills the mirror once at startup (before the first screen renders), and
 * every request after that reads `get()` without touching disk.
 */
let cached: string | null = null

export const tokenStore = {
  /** Reads the saved token into memory. Call once, before any request. */
  async load(): Promise<string | null> {
    const saved = await storage.get(STORAGE_KEY)
    if (saved && !isExpired(saved)) {
      cached = saved
      return saved
    }
    cached = null
    if (saved) await storage.remove(STORAGE_KEY)
    return null
  },

  get(): string | null {
    if (cached && isExpired(cached)) {
      cached = null
      void storage.remove(STORAGE_KEY)
    }
    return cached
  },

  async set(token: string): Promise<void> {
    cached = token
    await storage.set(STORAGE_KEY, token)
  },

  async clear(): Promise<void> {
    cached = null
    await storage.remove(STORAGE_KEY)
  },
}
