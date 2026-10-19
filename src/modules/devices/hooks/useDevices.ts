import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { env } from '@/config/env'
import { useAuthStore } from '@/shared/store/authStore'
import { useNow } from '@/shared/lib/useNow'
import { fetchDevices, fetchFleetSummary } from '../api/devices.api'
import { toDeviceView } from '../lib/presence'

/**
 * The fleet, polled every 10 seconds.
 *
 * The backend's WebSocket belongs to the helmets, not to dashboards, so a
 * dashboard has nothing to subscribe to — it polls. React Query pauses the
 * interval while the app is in the background (see the AppState wiring in
 * the root layout), which matters on a phone's battery.
 */
export function useDeviceViews() {
  const query = useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    refetchInterval: env.pollIntervalMs,
  })

  // Presence is resolved against a ticking clock rather than inside `select`:
  // a helmet that has gone quiet produces no new data, so nothing would ever
  // re-run a select — and it would stay "online" forever.
  const now = useNow(10_000)
  const devices = useMemo(
    () => (query.data ?? []).map((device) => toDeviceView(device, now)),
    [query.data, now]
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

export function useFleetSummary() {
  return useQuery({
    queryKey: ['fleet-summary'],
    queryFn: fetchFleetSummary,
    refetchInterval: env.pollIntervalMs,
  })
}

/**
 * deviceId → display name, for screens that only carry an ID (alarms).
 *
 * Names are display-only; every API call uses the deviceId. This reads the
 * same cache as the fleet list but doesn't poll on its own — it needs the
 * names, not fresh telemetry.
 */
export function useDeviceNames(): Map<string, string> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { data } = useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })
  // Same reasoning as useAlarms: never serve a signed-out session's data.
  return useMemo(
    () => new Map((isAuthenticated ? (data ?? []) : []).map((d) => [d.id, d.name])),
    [data, isAuthenticated]
  )
}
