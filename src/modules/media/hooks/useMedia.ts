import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/shared/store/authStore'
import { useDeviceNames } from '@/modules/devices/hooks/useDevices'
import { fetchMedia, fetchVideoCalendar } from '../api/media.api'
import type { MediaItem, MediaQuery } from '../types'

/**
 * Photos and recordings, filtered by helmet and day on the server (and by file name here, so typing doesn't refetch and a
 * helmet's name finds its clips). Every photo and video link is signed and dies after an hour, so the list is refetched
 * well inside that, and the viewer refetches early if a link fails anyway.
 */
export function useMediaList(query: MediaQuery = {}) {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  const nameOf = useDeviceNames()
  const key = useMemo(() => ({ kind: query.kind ?? null, deviceId: query.deviceId ?? null, date: query.date ?? null }), [query.kind, query.deviceId, query.date])

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['media', 'list', key],
    queryFn: () => fetchMedia({ kind: query.kind, deviceId: query.deviceId, date: query.date }),
    enabled: signedIn,
    // Keeps the previous page visible while a new filter loads, rather than flashing an empty list when the day changes.
    placeholderData: (previous) => previous,
    staleTime: 20 * 60_000,
    refetchInterval: 40 * 60_000,
    gcTime: 45 * 60_000,
  })

  const needle = query.search?.trim().toLowerCase() ?? ''
  const media: MediaItem[] = useMemo(() => {
    // Photos and videos only carry a device id; the name comes from the device list that's already loaded.
    const named = (data ?? []).map((m) => ({ ...m, deviceName: nameOf.get(m.deviceId) ?? m.deviceName }))
    if (!needle) return named
    return named.filter((m) => m.deviceName.toLowerCase().includes(needle) || m.deviceId.includes(needle) || (m.fileName?.toLowerCase().includes(needle) ?? false))
  }, [data, nameOf, needle])

  return { media, isLoading, isFetching, isError, refetch }
}

/** Days with recordings in a month, for the Video Record calendar. */
export function useVideoCalendar(month: string, deviceId?: string) {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: ['media', 'calendar', deviceId ?? null, month],
    queryFn: () => fetchVideoCalendar(month, deviceId),
    enabled: signedIn,
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  })
}
