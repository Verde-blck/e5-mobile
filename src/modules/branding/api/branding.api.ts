import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { normaliseColour } from '../lib/colour'
import { EMPTY_PROFILE } from '../types'
import type { CompanyProfile } from '../types'

interface ApiProfile {
  companyName?: string | null
  supportEmail?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  updatedAt?: string | null
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function toProfile(api: ApiProfile | null | undefined): CompanyProfile {
  return {
    companyName: text(api?.companyName),
    supportEmail: text(api?.supportEmail),
    logoUrl: text(api?.logoUrl),
    primaryColor: api?.primaryColor ? normaliseColour(api.primaryColor) : null,
    secondaryColor: api?.secondaryColor ? normaliseColour(api.secondaryColor) : null,
    updatedAt: text(api?.updatedAt),
  }
}

export async function fetchBranding(): Promise<CompanyProfile> {
  if (env.useMocks) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return { ...EMPTY_PROFILE, companyName: 'E5 Energy', supportEmail: 'support@e5energyng.com', ...((globalThis as { __e5Branding?: Partial<CompanyProfile> }).__e5Branding ?? {}) }
  }
  const { data } = await apiClient.get<ApiProfile>('/branding')
  return toProfile(data)
}
