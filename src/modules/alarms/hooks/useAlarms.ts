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

// While the stream is up, polling is only a slow safety net; while it is down,
// polling is the only way alarms arrive, so it returns to the normal rate.
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

  // Without this gate the previous account's SOS would still be on screen for whoever signs in next.
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

export function useCriticalAlarms(): Alarm[] {
  const { alarms, now } = useAlarms()
  return useMemo(() => criticalActive(alarms, now), [alarms, now])
}

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
