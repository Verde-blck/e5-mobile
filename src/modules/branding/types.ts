export interface CompanyProfile {
  companyName: string | null
  supportEmail: string | null
  // Signed, valid for an hour: fetched fresh on load and never stored.
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  updatedAt: string | null
}

export const EMPTY_PROFILE: CompanyProfile = { companyName: null, supportEmail: null, logoUrl: null, primaryColor: null, secondaryColor: null, updatedAt: null }
