import { create } from 'zustand'
import type { Permission } from '@/shared/constants/modules'

// Computed by the backend, NOT derived on the device, so there is
// one authority for the rule rather than two that can drift.
export interface SiteScope {
  allSites: boolean
  sites: string[]
}

export interface AuthUser {
  id: string
  username: string
  name: string
  email?: string
  role: string
  permissions: Permission[]
  // MONITORING_CENTER_MANAGE), kept so the Administrators form can offer only what this
  // person may hand out: the backend refuses to let anyone grant a code they don't hold.
  apiPermissions?: string[]
  mustChangePassword?: boolean
  scope?: SiteScope
  superAdmin?: boolean
  // The backend already filters devices, alarms, the stream and the summary to
  // this list, so the app doesn't have to, it's carried for display.
  deviceIds?: string[]
  twoFactorEnabled?: boolean
  mustSetup2fa?: boolean
}

interface AuthState {
  user: AuthUser | null
  isBootstrapping: boolean
  isAuthenticated: boolean
  setUser: (user: AuthUser | null) => void
  setBootstrapping: (v: boolean) => void
  clearUser: () => void
  requireSetup: () => void
}

// Ending a session properly also has to clear the token and the query
// cache, use endSession() in shared/lib/session.ts, never this directly.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isBootstrapping: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setBootstrapping: (v) => set({ isBootstrapping: v }),
  clearUser: () => set({ user: null, isAuthenticated: false }),
  requireSetup: () => set((s) => (s.user && !s.user.mustSetup2fa ? { user: { ...s.user, mustSetup2fa: true } } : s)),
}))
