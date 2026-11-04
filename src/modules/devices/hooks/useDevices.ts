import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { env } from '@/config/env'
import { useAuthStore } from '@/shared/store/authStore'
import { isForbidden } from '@/shared/lib/errors'
import { useCan } from '@/shared/lib/permissions'
import { useNow } from '@/shared/lib/useNow'
import { fetchAlarms } from '@/modules/alarms/api/alarms.api'
import { ALARMS_KEY } from '@/modules/alarms/lib/alarm-cache'
import { fetchDevices, fetchFleetSummary, fetchGasStatus } from '../api/devices.api'
import { toDeviceView } from '../lib/presence'
import { withAlarmState, worstOpenAlarms } from '../lib/alarmState'
import type { Device } from '../types'

// The backend's WebSocket belongs to the helmets, not to
// dashboards, so a dashboard has nothing to subscribe to, it
// polls.
export function useDeviceViews() {
  const query = useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    refetchInterval: env.pollIntervalMs,
  })

  // Presence is resolved against a ticking clock rather than inside `select`: a helmet that has gone quiet
  // produces no new data, so nothing would ever re-run a select, and it would stay "online" forever.
  const now = useNow(10_000)
  // The same cached list the Alarms screen reads, not useAlarms itself, which imports these hooks.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const canReadAlarms = useCan('alarms:read')
  const { data: alarms } = useQuery({
    queryKey: ALARMS_KEY,
    queryFn: fetchAlarms,
    enabled: isAuthenticated && canReadAlarms,
    staleTime: 30_000,
    retry: (count, error) => !isForbidden(error) && count < 1,
  })
  const worstAlarms = useMemo(() => worstOpenAlarms(isAuthenticated ? (alarms ?? []) : []), [alarms, isAuthenticated])

  const devices = useMemo(
    () => (query.data ?? []).map((device) => withAlarmState(toDeviceView(device, now), worstAlarms)),
    [query.data, now, worstAlarms]
  )

  return {
    devices,
    now,
    isLoading: query.isLoading,
    isError: query.isError,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  }
}

// Whether a helmet's gas reading is current. Failing to get it is not an error worth showing: the screen then behaves as it did before.
export function useGasStatus(id: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: ['gas-status', id],
    queryFn: () => fetchGasStatus(id),
    enabled: isAuthenticated,
    refetchInterval: env.pollIntervalMs,
    retry: false,
  })
}

export function useFleetSummary() {
  return useQuery({
    queryKey: ['fleet-summary'],
    queryFn: fetchFleetSummary,
    refetchInterval: env.pollIntervalMs,
  })
}

// One helmet from the cached list, for the pop-up to name the wearer. Gated on being signed in like the names are.
export function useDeviceById(id: string | undefined): Device | undefined {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data } = useQuery({ queryKey: ['devices'], queryFn: fetchDevices, enabled: isAuthenticated && !!id, staleTime: 5 * 60_000 })
  return useMemo(() => (isAuthenticated && id ? data?.find((d) => d.id === id) : undefined), [data, id, isAuthenticated])
}

export function useDeviceNames(): Map<string, string> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data } = useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })
  // Gated on being signed in, so a previous account's devices are never served to whoever signs in next.
  return useMemo(
    () => new Map((isAuthenticated ? (data ?? []) : []).map((d) => [d.id, d.name])),
    [data, isAuthenticated]
  )
}
