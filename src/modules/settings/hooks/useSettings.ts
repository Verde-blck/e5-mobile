import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isForbidden } from '@/shared/lib/errors'
import { useCan } from '@/shared/lib/permissions'
import { useAuthStore } from '@/shared/store/authStore'
import {
  fetchSiteWifi,
  fetchUnitSettings,
  removeSiteWifi,
  saveSiteWifi,
  saveUnitSettings,
} from '../api/settings.api'
import type { UnitSettings } from '../types'

const noRetryWhenForbidden = (count: number, error: unknown) => !isForbidden(error) && count < 1

export function useSiteWifi() {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  const canRead = useCan('wifi:read')
  return useQuery({
    queryKey: ['site-wifi'],
    queryFn: fetchSiteWifi,
    enabled: signedIn && canRead,
    retry: noRetryWhenForbidden,
  })
}

export function useSaveSiteWifi() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveSiteWifi,
    onSuccess: (saved) => queryClient.setQueryData(['site-wifi'], saved),
  })
}

export function useRemoveSiteWifi() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removeSiteWifi,
    onSuccess: () => queryClient.setQueryData(['site-wifi'], null),
  })
}

export function useUnitSettings(deviceId: string) {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  const canRead = useCan('unitSettings:read')
  return useQuery({
    queryKey: ['unit-settings', deviceId],
    queryFn: () => fetchUnitSettings(deviceId),
    enabled: signedIn && canRead && !!deviceId,
    retry: noRetryWhenForbidden,
  })
}

export function useSaveUnitSettings(deviceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: UnitSettings) => saveUnitSettings(deviceId, patch),
    onSuccess: (result) =>
      queryClient.setQueryData(['unit-settings', deviceId], (previous: UnitSettings | undefined) => ({
        ...previous,
        ...result.settings,
      })),
  })
}
