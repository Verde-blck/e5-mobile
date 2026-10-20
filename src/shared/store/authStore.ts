import { create } from 'zustand'
import type { Permission } from '@/shared/constants/modules'

/**
 * Which sites this user may see. Computed by the backend, NOT derived on the
 * device, so there is one authority for the rule rather than two that can drift.
 */
export interface SiteScope {
  allSites: boolean
  sites: string[]
}

export interface AuthUser {
  id: string
  /** Login identifier, issued by the employer. Not an email. */
  username: string
  name: string
  /** Contact only — not used to sign in. */
  email?: string
  role: string
  permissions: Permission[]
  /**
   * The backend's own permission codes (e.g. MONITORING_CENTER_MANAGE), kept so the Administrators form can
   * offer only what this person may hand out: the backend refuses to let anyone grant a code they don't hold.
   * Absent on a profile cached before this existed, which is treated as none.
   */
  apiPermissions?: string[]
  /**
   * Set when an administrator issued or reset the password. The web dashboard
   * refuses to render anything but a change-password screen until it clears.
   * The mobile app carries the flag but doesn't act on it yet.
   */
  mustChangePassword?: boolean
  scope?: SiteScope
  /** True for the main administrator: full access, `permissions` ignored by the server. */
  superAdmin?: boolean
  /**
   * The helmets this account is limited to. Empty means every helmet. The
   * backend already filters devices, alarms, the stream and the summary to
   * this list, so the app doesn't have to — it's carried for display.
   */
  deviceIds?: string[]
  /** From the server (GET /auth/me), so it is never a guess. */
  twoFactorEnabled?: boolean
}

interface AuthState {
  user: AuthUser | null
  /** True while the saved session is being restored on launch. */
  isBootstrapping: boolean
  isAuthenticated: boolean
  setUser: (user: AuthUser | null) => void
  setBootstrapping: (v: boolean) => void
  clearUser: () => void
}

// React Query owns server *data*; Zustand owns the session, which many
// unrelated components need.
//
// clearUser() only touches this store. Ending a session properly also has to
// clear the token and the query cache — use endSession() in
// shared/lib/session.ts, never this directly.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isBootstrapping: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setBootstrapping: (v) => set({ isBootstrapping: v }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
}))
