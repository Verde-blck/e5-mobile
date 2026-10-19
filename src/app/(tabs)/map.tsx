import { useMemo, useState } from 'react'
import { FlatList, Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { useLayout } from '@/shared/lib/layout'
import { useSelectionStore } from '@/shared/store/selectionStore'
import { openAlarm } from '@/modules/alarms/components/AlarmCard'
import { useAlarms } from '@/modules/alarms/hooks/useAlarms'
import { BatteryChip } from '@/modules/devices/components/BatteryChip'
import { DeviceCard, openHelmet } from '@/modules/devices/components/DeviceCard'
import { HelmetDetailView } from '@/modules/devices/components/HelmetDetailView'
import { PresenceBadge } from '@/modules/devices/components/PresenceBadge'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { describeFix } from '@/modules/devices/lib/location'
import { PRESENCE_ORDER, lastSeenLabel } from '@/modules/devices/lib/presence'
import type { Presence } from '@/modules/devices/types'
import { MapSurface } from '@/modules/map/components/MapSurface'
import { buildMapAlarms, buildMapHelmets, countByPresence } from '@/modules/map/lib/mapData'

type Filter = 'all' | Presence

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'degraded', label: 'Degraded' },
  { key: 'offline', label: 'Offline' },
]

const PANEL_WIDTH = 380

function MapScreen() {
  const { devices, now, isLoading, isError, refetch } = useDeviceViews()
  const { active } = useAlarms()
  const { twoPane } = useLayout()
  const selectedId = useSelectionStore((s) => s.helmetId)
  const select = useSelectionStore((s) => s.selectHelmet)
  const [filter, setFilter] = useState<Filter>('all')
  const [fitKey, setFitKey] = useState(0)

  // The counts on the chips describe the whole fleet; the map and list follow the filter.
  const everything = useMemo(() => buildMapHelmets(devices, active), [devices, active])
  const counts = useMemo(() => countByPresence(everything.placed), [everything.placed])

  const shown = useMemo(
    () => devices.filter((d) => filter === 'all' || d.presence === filter),
    [devices, filter]
  )
  const { placed, unplaced } = useMemo(() => buildMapHelmets(shown, active), [shown, active])
  const mapAlarms = useMemo(() => buildMapAlarms(active), [active])

  const selected = devices.find((d) => d.id === selectedId)
  const listed = useMemo(
    () =>
      [...shown].sort(
        (a, b) =>
          PRESENCE_ORDER[a.presence] - PRESENCE_ORDER[b.presence] ||
          Number(a.named === false) - Number(b.named === false) ||
          a.name.localeCompare(b.name)
      ),
    [shown]
  )

  if (isLoading) {
    return (
      <Screen>
        <LoadingState label="Loading the map…" />
      </Screen>
    )
  }
  if (isError && devices.length === 0) {
    return (
      <Screen>
        <ErrorState onRetry={() => void refetch()} />
      </Screen>
    )
  }
  if (devices.length === 0) {
    return (
      <Screen>
        <EmptyState icon="map" title="No helmets yet" hint="Helmets appear on the map once they report a position." />
      </Screen>
    )
  }

  const map = (
    <View className="flex-1">
      <MapSurface
        helmets={placed}
        alarms={mapAlarms}
        selectedId={selectedId}
        fitKey={fitKey}
        onSelectHelmet={select}
        onSelectAlarm={openAlarm}
      />

      {/* filters */}
      <View pointerEvents="box-none" className="absolute left-3 right-16 top-3 flex-row flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => {
          const on = filter === key
          return (
            <Pressable
              key={key}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(key)}
              className={cn(
                'rounded-full border px-3 py-1.5 shadow-sm',
                on ? 'border-brand-primary bg-brand-primary' : 'border-slate-200 bg-white'
              )}
            >
              <Text className={cn('font-sans-medium text-xs', on ? 'text-white' : 'text-slate-700')}>
                {label} {counts[key]}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fit all helmets"
        hitSlop={6}
        onPress={() => setFitKey((k) => k + 1)}
        className="absolute right-3 top-3 h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md active:bg-slate-100"
      >
        <Feather name="maximize" size={18} color="#0C352F" />
      </Pressable>

      {unplaced.length > 0 && !(selected && !twoPane) ? (
        <View className="absolute bottom-8 left-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
          <Text className="text-xs text-slate-600">
            {unplaced.length} {unplaced.length === 1 ? 'helmet has' : 'helmets have'} no position yet
          </Text>
        </View>
      ) : null}

      {/* narrow screens: the chosen helmet in a card over the map */}
      {!twoPane && selected ? (
        <View className="absolute inset-x-3 bottom-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-sans-semibold text-base" numberOfLines={1}>
                {selected.name}
              </Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                Last seen {lastSeenLabel(selected.lastSeenAt, now)}
                {describeFix(selected.telemetry) ? ` · ${describeFix(selected.telemetry)?.label}` : ''}
              </Text>
            </View>
            <PresenceBadge presence={selected.presence} />
            <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" onPress={() => select(null)}>
              <Feather name="x" size={20} color="#64748B" />
            </Pressable>
          </View>
          <View className="mt-3 flex-row items-center justify-between">
            <BatteryChip percent={selected.telemetry.batteryPercent} />
            <Button title="Details" onPress={() => openHelmet(selected.id)} className="h-10 px-6" />
          </View>
        </View>
      ) : null}
    </View>
  )

  if (!twoPane) return <Screen top>{map}</Screen>

  // wide screens: the map, with the helmets (or the chosen one) in a panel on the right
  return (
    <Screen>
      <View className="flex-1 flex-row">
        {map}
        <View className="border-l border-slate-200 bg-slate-50" style={{ width: PANEL_WIDTH }}>
          {selected ? (
            <View className="flex-1">
              <Pressable
                accessibilityRole="button"
                onPress={() => select(null)}
                hitSlop={8}
                className="flex-row items-center gap-1 px-4 pb-1 pt-4"
              >
                <Feather name="chevron-left" size={18} color="#0A6659" />
                <Text className="font-sans-semibold text-sm text-brand-primary">All helmets</Text>
              </Pressable>
              <HelmetDetailView key={selected.id} id={selected.id} embedded />
            </View>
          ) : (
            <View className="flex-1">
              <View className="px-4 pb-1 pt-4">
                <Text className="font-display-bold text-xl">Helmets</Text>
                <Text className="mt-0.5 text-xs text-slate-500">
                  {placed.length} on the map · tap one to see it
                </Text>
              </View>
              <FlatList
                data={listed}
                keyExtractor={(d) => d.id}
                renderItem={({ item }) => (
                  <DeviceCard device={item} now={now} selected={false} onOpen={select} />
                )}
                contentContainerClassName="px-4 pb-8 pt-2"
              />
            </View>
          )}
        </View>
      </View>
    </Screen>
  )
}

export default function MapRoute() {
  return (
    <RequirePermission permission="map:read" fallback="/more">
      <MapScreen />
    </RequirePermission>
  )
}
