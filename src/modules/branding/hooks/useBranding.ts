import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/store/authStore'
import { fetchBranding, fetchCompany, removeLogo, saveCompany, uploadLogo } from '../api/branding.api'
import type { LogoFile } from '../api/branding.api'
import { DEFAULT_BRAND, brandFor, primaryProblem } from '../lib/colour'
import { EMPTY_PROFILE } from '../types'
import type { CompanyPatch, CompanyProfile } from '../types'

/**
 * The company's branding, for the sign-in screen and the whole app. Public, so it works before anyone signs in. If it can't be
 * fetched (no signal), the E5 look is used rather than anything blank. The logo link expires after an hour, so it is refetched
 * well inside that and never kept anywhere else.
 */
export function useBranding(): CompanyProfile {
  const { data } = useQuery({ queryKey: ['branding'], queryFn: fetchBranding, staleTime: 30 * 60_000, refetchInterval: 50 * 60_000, retry: 1 })
  return data ?? EMPTY_PROFILE
}

/** The colours the app is drawn in: the company's primary (and what is worked out from it), or the E5 look. */
export function useBrand() {
  const profile = useBranding()
  return useMemo(() => ({ colours: brandFor(profile.primaryColor), problem: primaryProblem(profile.primaryColor), profile }), [profile])
}

/** Just the colours, for the few places that need a colour as a value rather than a style class. */
export function useBrandColours() {
  return useBrand().colours ?? DEFAULT_BRAND
}

/**
 * Fetches the public branding while the saved session is being restored, so the company's colours are in place before the first
 * screen shows rather than flashing the E5 look first. It never holds the launch up for long: after 1.5 s the app opens anyway
 * and the colours arrive when they arrive; with no signal it simply stays on the E5 look.
 */
export async function prefetchBranding(queryClient: QueryClient): Promise<void> {
  const fetching = queryClient.prefetchQuery({ queryKey: ['branding'], queryFn: fetchBranding, staleTime: 30 * 60_000 }).catch(() => undefined)
  await Promise.race([fetching, new Promise((resolve) => setTimeout(resolve, 1_500))])
}

/** The profile for the company screen (any signed-in user may read it). */
export function useCompany() {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  return useQuery({ queryKey: ['company'], queryFn: fetchCompany, enabled: signedIn, staleTime: 60_000 })
}

function useRemember() {
  const queryClient = useQueryClient()
  // Every save answers with the whole profile, so both copies are updated at once and the app re-themes immediately.
  return (profile: CompanyProfile) => {
    queryClient.setQueryData(['branding'], profile)
    queryClient.setQueryData(['company'], profile)
  }
}

export function useSaveCompany() {
  const remember = useRemember()
  return useMutation({ mutationFn: (patch: CompanyPatch) => saveCompany(patch), onSuccess: remember })
}

export function useUploadLogo() {
  const remember = useRemember()
  return useMutation({ mutationFn: (logo: LogoFile) => uploadLogo(logo), onSuccess: remember })
}

export function useRemoveLogo() {
  const remember = useRemember()
  return useMutation({ mutationFn: () => removeLogo(), onSuccess: remember })
}
