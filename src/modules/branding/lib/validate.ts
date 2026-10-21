import { normaliseColour } from './colour'
import type { CompanyField } from '../types'

/** The backend's limits, checked here first so the person finds out before sending anything. */
export const NAME_MAX = 80
export const LOGO_MAX_BYTES = 512 * 1024
export const LOGO_MAX_SIDE = 1024
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export type CompanyErrors = Partial<Record<CompanyField, string>>

export function validateCompany(form: { companyName: string; supportEmail: string; primaryColor: string; secondaryColor: string }): CompanyErrors {
  const errors: CompanyErrors = {}
  if (form.companyName.trim().length > NAME_MAX) errors.companyName = `The name can be up to ${NAME_MAX} characters.`
  if (form.supportEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail.trim())) errors.supportEmail = 'That doesn’t look like an email address.'
  if (form.primaryColor.trim() && !normaliseColour(form.primaryColor)) errors.primaryColor = 'Use a colour like #0B5CAD.'
  if (form.secondaryColor.trim() && !normaliseColour(form.secondaryColor)) errors.secondaryColor = 'Use a colour like #F28C28.'
  return errors
}

/** Why a chosen picture can't be the logo, or null if it can. The backend checks the real image, not the name. */
export function logoProblem(file: { mimeType?: string | null; name?: string; size?: number | null; width?: number; height?: number }): string | null {
  const type = (file.mimeType ?? '').toLowerCase()
  const byName = /\.(png|jpe?g|webp)$/i.test(file.name ?? '')
  if (!(LOGO_TYPES as readonly string[]).includes(type) && !(type === '' && byName)) return 'The logo must be a PNG, JPEG or WebP picture.'
  if (file.size != null && file.size > LOGO_MAX_BYTES) return `The logo can be up to 512 KB (this one is ${Math.round(file.size / 1024)} KB).`
  if (file.width != null && file.height != null && (file.width > LOGO_MAX_SIDE || file.height > LOGO_MAX_SIDE)) return `The logo can be up to ${LOGO_MAX_SIDE} px on each side (this one is ${file.width} x ${file.height}).`
  return null
}

const FIELD: Record<string, CompanyField> = {
  invalid_companyName: 'companyName',
  invalid_supportEmail: 'supportEmail',
  invalid_primaryColor: 'primaryColor',
  invalid_secondaryColor: 'secondaryColor',
  invalid_logo: 'logo',
}

/** An answer from the company endpoints turned into the field it is about and words to show. */
export function describeCompanyError(error: unknown): { field?: CompanyField; message: string } {
  const e = error as { response?: { status?: number; data?: { error?: string; message?: string } } }
  const status = e?.response?.status
  const body = e?.response?.data
  if (!status) return { message: "Couldn't reach the server. Check the connection and try again." }
  if (status === 400 && body?.error && FIELD[body.error]) return { field: FIELD[body.error], message: body.message ?? 'That value was not accepted.' }
  if (status === 401) return { message: 'Your session has expired. Sign in again.' }
  if (status === 403) return { message: "This account isn't allowed to change the company profile." }
  if (status >= 500) return { message: 'The server had a problem. The connection is fine.' }
  return { message: body?.message ?? `The server refused it (HTTP ${status}).` }
}
