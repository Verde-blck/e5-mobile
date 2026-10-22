import { useMemo } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { fetchBranding } from '../api/branding.api'
import { DEFAULT_BRAND, brandFor, primaryProblem } from '../lib/colour'
import { EMPTY_PROFILE } from '../types'
import type { CompanyProfile } from '../types'

/**
 * The company's branding, for the sign-in screen and the whole app. Public, so it works before anyone signs in. If it can't be
 * fetched (no signal, or a backend that doesn't have it yet), the E5 look is used rather than anything blank. The logo link expires
 * after an hour, so it is refetched well inside that and never kept anywhere else.
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
