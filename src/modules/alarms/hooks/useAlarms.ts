import { useMemo, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { env } from '@/config/env'
import { isForbidden } from '@/shared/lib/errors'
import { useCan } from '@/shared/lib/permissions'
import { useNow } from '@/shared/lib/useNow'
import { useAuthStore } from '@/shared/store/authStore'
import { useDeviceNames } from '@/modules/devices/hooks/useDevices'
import { fetchAlarmDetail, fetchAlarms, setAlarmResolved } from '../api/alarms.api'
import { FOOTAGE_POLL_MS, videoStatus } from '../footage'
import { ALARMS_KEY } from '../lib/alarm-cache'
import { criticalActive } from '../lib/alert-policy'
import { streamStatus } from '../lib/alarmStream'
import type { Alarm } from '../types'

/**
 * The alarm list, newest first with unresolved ones pinned on top — someone
 * opening this during an incident shouldn't have to scroll to find it.
 *
 * New alarms arrive instantly over the stream (see LiveAlarms) and are written
 * straight into this list's cache. While the stream is up, polling is only a
 * slow safety net; while it's down, polling is the only way alarms arrive, so
 * it goes back to the normal interval.
 *
 * An account without alarm access (alarms:read) never fetches the list, but
 * still receives stream events into the same cache, so it still sees the
 * banner for a live SOS.
 */
export function useAlarms() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const canRead = useCan('alarms:read')
  const streaming = useSyncExternalStore(streamStatus.subscribe, streamStatus.get) === 'open'
  const names = useDeviceNames()
  const now = useNow(10_000)

  const query = useQuery({
    queryKey: ALARMS_KEY,
    queryFn: fetchAlarms,
    enabled: isAuthenticated && canRead,
    // A permission refusal won't fix itself, so don't keep asking.
    refetchInterval: (q) =>
      isForbidden(q.state.error) ? false : streaming ? 120_000 : env.pollIntervalMs,
    retry: (count, error) => !isForbidden(error) && count < 1,
  })

  // Signing out clears the cache, but an observer that's still mounted (the
  // banner's, for one) keeps the last result it saw. Without this gate the
  // previous account's SOS would still be on screen for whoever signs in next.
  const data = isAuthenticated ? query.data : undefined

  const alarms = useMemo(() => {
    const named = (data ?? []).map(
      (a): Alarm => ({ ...a, deviceName: names.get(a.deviceId) ?? a.deviceName })
    )
    return named.sort((a, b) => {
      const activeFirst = Number(b.status === 'active') - Number(a.status === 'active')
      return activeFirst !== 0 ? activeFirst : b.raisedAt - a.raisedAt
    })
  }, [data, names])

  const active = useMemo(() => alarms.filter((a) => a.status === 'active'), [alarms])

  return {
    alarms,
    active,
    now,
    isLoading: query.isLoading,
    isError: query.isError,
    isForbidden: isForbidden(query.error),
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  }
}

/** Unresolved critical alarms inside the alert window — what the banner and siren follow. */
export function useCriticalAlarms(): Alarm[] {
  const { alarms, now } = useAlarms()
  return useMemo(() => criticalActive(alarms, now), [alarms, now])
}

/**
 * One alarm with its linked footage. Re-checks every 30 s while clips are
 * still on their way (the backend's advice), and stops once they've arrived or
 * the alarm is too old for any to be expected.
 */
export function useAlarmDetail(id: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const query = useQuery({
    queryKey: ['alarm', id],
    queryFn: () => fetchAlarmDetail(id),
    enabled: isAuthenticated && !!id,
    refetchInterval: (q) => {
      if (isForbidden(q.state.error)) return false
      const detail = q.state.data
      return detail && videoStatus(detail, Date.now()) === 'uploading' ? FOOTAGE_POLL_MS : false
    },
    retry: (count, error) => !isForbidden(error) && count < 1,
  })
  return { ...query, isForbidden: isForbidden(query.error) }
}

export function useResolveAlarm() {
  const queryClient = useQueryClient()
  const userName = useAuthStore((s) => s.user?.name)

  return useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      setAlarmResolved(id, resolved),
    onMutate: async ({ id, resolved }) => {
      // Optimistic: a resolve that takes a round-trip to grey out feels broken
      // during an incident, which is exactly when it gets used.
      await queryClient.cancelQueries({ queryKey: ALARMS_KEY })
      const previous = queryClient.getQueryData<Alarm[]>(ALARMS_KEY)

      queryClient.setQueryData<Alarm[]>(ALARMS_KEY, (list) =>
        list?.map(
          (a): Alarm =>
            a.id === id
              ? {
                  ...a,
                  status: resolved ? 'resolved' : 'active',
                  resolvedAt: resolved ? Date.now() : undefined,
                  resolvedBy: resolved ? userName : undefined,
                }
              : a
        )
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(ALARMS_KEY, context.previous)
    },
    onSettled: (_data, _error, vars) => {
      void queryClient.invalidateQueries({ queryKey: ALARMS_KEY })
      void queryClient.invalidateQueries({ queryKey: ['alarm', vars.id] })
      void queryClient.invalidateQueries({ queryKey: ['fleet-summary'] })
    },
  })
}
