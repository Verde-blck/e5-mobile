/** The company profile (GET /api/branding and GET/PUT /api/settings/company). Fields that aren't set are null. */
export interface CompanyProfile {
  companyName: string | null
  supportEmail: string | null
  /** Signed, valid for an hour: fetched fresh on load and never stored. */
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  updatedAt: string | null
}

export const EMPTY_PROFILE: CompanyProfile = { companyName: null, supportEmail: null, logoUrl: null, primaryColor: null, secondaryColor: null, updatedAt: null }

/** What can be sent to PUT /api/settings/company: any subset, and "" clears a field. */
export interface CompanyPatch {
  companyName?: string
  supportEmail?: string
  primaryColor?: string
  secondaryColor?: string
}

export type CompanyField = 'companyName' | 'supportEmail' | 'primaryColor' | 'secondaryColor' | 'logo'
