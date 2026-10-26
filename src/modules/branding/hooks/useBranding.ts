import { useMemo } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { fetchBranding } from '../api/branding.api'
import { DEFAULT_BRAND, brandFor, primaryProblem } from '../lib/colour'
import { EMPTY_PROFILE } from '../types'
import type { CompanyProfile } from '../types'

export function useBranding(): CompanyProfile {
  const { data } = useQuery({ queryKey: ['branding'], queryFn: fetchBranding, staleTime: 30 * 60_000, refetchInterval: 50 * 60_000, retry: 1 })
  return data ?? EMPTY_PROFILE
}

export function useBrand() {
  const profile = useBranding()
  return useMemo(() => ({ colours: brandFor(profile.primaryColor), problem: primaryProblem(profile.primaryColor), profile }), [profile])
}

export function useBrandColours() {
  return useBrand().colours ?? DEFAULT_BRAND
}

// Fetches the public branding while the saved session is being restored, so the company's
// colours are in place before the first screen shows rather than flashing the E5 look first.
export async function prefetchBranding(queryClient: QueryClient): Promise<void> {
  const fetching = queryClient.prefetchQuery({ queryKey: ['branding'], queryFn: fetchBranding, staleTime: 30 * 60_000 }).catch(() => undefined)
  await Promise.race([fetching, new Promise((resolve) => setTimeout(resolve, 1_500))])
}
