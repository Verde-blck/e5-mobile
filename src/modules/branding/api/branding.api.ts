import { apiClient } from '@/shared/lib/api-client'
import { env } from '@/config/env'
import { normaliseColour } from '../lib/colour'
import { EMPTY_PROFILE } from '../types'
import type { CompanyPatch, CompanyProfile } from '../types'

/*
 * Company profile and branding (backend update of 21 Oct 2026).
 *
 *   GET    /api/branding                public: the sign-in screen and app start
 *   GET    /api/settings/company        any signed-in user: the same data
 *   PUT    /api/settings/company        ADMINISTRATOR_SETTING: any subset of fields; "" clears one
 *   POST   /api/settings/company/logo   ADMINISTRATOR_SETTING: multipart field `file`
 *   DELETE /api/settings/company/logo   ADMINISTRATOR_SETTING
 *
 * All five answer with the profile. logoUrl is signed and expires after an hour, so it is fetched on load and never stored.
 */

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

/** A picture chosen for the logo: a file on the tablet, or (in a browser) a real File. */
export interface LogoFile {
  uri: string
  name: string
  mimeType: string
  file?: Blob
}

// --- Sample data ---------------------------------------------------------

let mock: CompanyProfile | null = null
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function mockProfile(): CompanyProfile {
  // test hook: start from a particular company
  mock ??= { ...EMPTY_PROFILE, companyName: 'E5 Energy', supportEmail: 'support@e5energyng.com', ...((globalThis as { __e5Branding?: Partial<CompanyProfile> }).__e5Branding ?? {}) }
  return mock
}

function rejected(error: string, message: string): never {
  throw Object.assign(new Error(message), { response: { status: 400, data: { error, message } } })
}

function mockSave(patch: CompanyPatch): CompanyProfile {
  const next = { ...mockProfile() }
  if (patch.companyName !== undefined) {
    if (patch.companyName.length > 80) rejected('invalid_companyName', 'companyName must be at most 80 characters')
    next.companyName = text(patch.companyName)
  }
  if (patch.supportEmail !== undefined) {
    if (patch.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.supportEmail)) rejected('invalid_supportEmail', 'supportEmail is not a valid email address')
    next.supportEmail = text(patch.supportEmail)
  }
  for (const key of ['primaryColor', 'secondaryColor'] as const) {
    const value = patch[key]
    if (value === undefined) continue
    if (value === '') next[key] = null
    else {
      const colour = normaliseColour(value)
      if (!colour) rejected(`invalid_${key}`, `${key} must look like #RRGGBB`)
      next[key] = colour
    }
  }
  next.updatedAt = new Date().toISOString()
  mock = next
  return next
}

// --- Real ----------------------------------------------------------------

export async function fetchBranding(): Promise<CompanyProfile> {
  if (env.useMocks) {
    await wait(100)
    return { ...mockProfile() }
  }
  const { data } = await apiClient.get<ApiProfile>('/branding')
  return toProfile(data)
}

export async function fetchCompany(): Promise<CompanyProfile> {
  if (env.useMocks) {
    await wait(150)
    return { ...mockProfile() }
  }
  const { data } = await apiClient.get<ApiProfile>('/settings/company')
  return toProfile(data)
}

/** Saves any subset of fields; an empty string clears one. Nothing is saved if any field is invalid. */
export async function saveCompany(patch: CompanyPatch): Promise<CompanyProfile> {
  if (env.useMocks) {
    await wait(300)
    return mockSave(patch)
  }
  const { data } = await apiClient.put<ApiProfile>('/settings/company', patch)
  return toProfile(data)
}

export async function uploadLogo(logo: LogoFile): Promise<CompanyProfile> {
  if (env.useMocks) {
    await wait(400)
    // test hook: the server turning the picture down
    const refusal = (globalThis as { __e5LogoRefusal?: string }).__e5LogoRefusal
    if (refusal) rejected('invalid_logo', refusal)
    mock = { ...mockProfile(), logoUrl: logo.uri, updatedAt: new Date().toISOString() }
    return mock
  }
  const form = new FormData()
  if (logo.file) form.append('file', logo.file, logo.name)
  else form.append('file', { uri: logo.uri, name: logo.name, type: logo.mimeType } as unknown as Blob)
  const { data } = await apiClient.post<ApiProfile>('/settings/company/logo', form, { headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: (body) => body })
  return toProfile(data)
}

export async function removeLogo(): Promise<CompanyProfile> {
  if (env.useMocks) {
    await wait(250)
    mock = { ...mockProfile(), logoUrl: null, updatedAt: new Date().toISOString() }
    return mock
  }
  const { data } = await apiClient.delete<ApiProfile>('/settings/company/logo')
  return toProfile(data)
}
