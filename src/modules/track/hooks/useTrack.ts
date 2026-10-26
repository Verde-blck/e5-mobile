import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isForbidden } from '@/shared/lib/errors'
import { useAuthStore } from '@/shared/store/authStore'
import { fetchTrackSamples } from '../api/track.api'
import { buildAvailability } from '../lib/availability'
import { buildTrack } from '../lib/track'

export function useTrack(
  deviceId: string | null,
  from: number,
  to: number,
  enabled: boolean,
  includeApproximate: boolean
) {
  const signedIn = useAuthStore((s) => s.isAuthenticated)
  const query = useQuery({
    queryKey: ['track', deviceId, from, to],
    queryFn: () => fetchTrackSamples(deviceId as string, from, to),
    enabled: signedIn && enabled && !!deviceId,
    staleTime: 5 * 60_000,
    retry: (count, error) => !isForbidden(error) && count < 1,
  })

  const data = query.data
  const track = useMemo(
    () => (data && deviceId ? buildTrack(deviceId, data.samples, from, to, data.truncated, { includeApproximate }) : null),
    [data, deviceId, from, to, includeApproximate]
  )
  const availability = useMemo(() => (data ? buildAvailability(data.samples, from, to) : null), [data, from, to])

  return {
    track,
    availability,
    isFetching: query.isFetching,
    isError: query.isError,
    isForbidden: isForbidden(query.error),
  }
}
