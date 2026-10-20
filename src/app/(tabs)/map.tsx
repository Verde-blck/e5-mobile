import { useMemo, useState } from 'react'
import { FlatList, Pressable, View } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { useLayout } from '@/shared/lib/layout'
import { useCan } from '@/shared/lib/permissions'
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
import { FenceCard } from '@/modules/fences/components/FenceCard'
import { FenceListPanel, editFence } from '@/modules/fences/components/FenceListPanel'
import { useFences } from '@/modules/fences/hooks/useFences'
import { MapSurface } from '@/modules/map/components/MapSurface'
import { buildMapAlarms, buildMapHelmets, countByPresence, toMapFence } from '@/modules/map/lib/mapData'

type Filter = 'all' | Presence
type PanelTab = 'helmets' | 'fences'

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
  const { fences } = useFences()
  const { twoPane } = useLayout()
  const canFences = useCan('fences:read')
  const canEditFences = useCan('fences:write')
  const selectedId = useSelectionStore((s) => s.helmetId)
  const select = useSelectionStore((s) => s.selectHelmet)
  const fenceId = useSelectionStore((s) => s.fenceId)
  const selectFence = useSelectionStore((s) => s.selectFence)
  const [filter, setFilter] = useState<Filter>('all')
  const [fitKey, setFitKey] = useState(0)
  const [showFences, setShowFences] = useState(true)
  const [panelTab, setPanelTab] = useState<PanelTab>('helmets')

  // The counts on the chips describe the whole fleet; the map and list follow the filter.
  const everything = useMemo(() => buildMapHelmets(devices, active), [devices, active])
  const counts = useMemo(() => countByPresence(everything.placed), [everything.placed])

  const shown = useMemo(() => devices.filter((d) => filter === 'all' || d.presence === filter), [devices, filter])
  const { placed, unplaced } = useMemo(() => buildMapHelmets(shown, active), [shown, active])
  const mapAlarms = useMemo(() => buildMapAlarms(active), [active])
  const mapFences = useMemo(() => (canFences && showFences ? fences.map(toMapFence) : []), [canFences, showFences, fences])

  const selected = devices.find((d) => d.id === selectedId)
  const selectedFence = canFences && showFences ? fences.find((f) => f.id === fenceId) : undefined
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
        fences={mapFences}
        selectedFenceId={fenceId}
        fitKey={fitKey}
        // Tapping empty map (id null) clears whatever was open; choosing a helmet replaces a chosen fence.
        onSelectHelmet={(id) => {
          select(id)
          selectFence(null)
        }}
        onSelectAlarm={openAlarm}
        onSelectFence={(id) => {
          selectFence(id)
          select(null)
          setPanelTab('fences')
        }}
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
              className={cn('rounded-full border px-3 py-1.5 shadow-sm', on ? 'border-brand-primary bg-brand-primary' : 'border-slate-200 bg-white')}
            >
              <Text className={cn('font-sans-medium text-xs', on ? 'text-white' : 'text-slate-700')}>
                {label} {counts[key]}
              </Text>
            </Pressable>
          )
        })}
        {canFences ? (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Fences ${fences.length}`}
            accessibilityState={{ selected: showFences }}
            onPress={() => setShowFences((v) => !v)}
            className={cn('flex-row items-center gap-1 rounded-full border px-3 py-1.5 shadow-sm', showFences ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white')}
          >
            <Feather name="hexagon" size={12} color={showFences ? '#B45309' : '#64748B'} />
            <Text className={cn('font-sans-medium text-xs', showFences ? 'text-amber-900' : 'text-slate-700')}>Fences {fences.length}</Text>
          </Pressable>
        ) : null}
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

      {unplaced.length > 0 && !((selected || selectedFence) && !twoPane) ? (
        <View className="absolute bottom-8 left-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
          <Text className="text-xs text-slate-600">
            {unplaced.length} {unplaced.length === 1 ? 'helmet has' : 'helmets have'} no position yet
          </Text>
        </View>
      ) : null}

      {/* narrow screens: a way into the fence list */}
      {!twoPane && canFences && !selected && !selectedFence ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/fences')}
          className="absolute bottom-20 left-3 flex-row items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 shadow-sm active:bg-slate-100"
        >
          <Feather name="hexagon" size={14} color="#0C352F" />
          <Text className="font-sans-semibold text-xs text-slate-800">Fence list</Text>
        </Pressable>
      ) : null}

      {/* narrow screens: the chosen helmet, or fence, in a card over the map */}
      {!twoPane && selected ? (
        <View className="absolute inset-x-3 bottom-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="font-sans-semibold text-base" numberOfLines={1}>{selected.name}</Text>
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

      {!twoPane && !selected && selectedFence ? (
        <View className="absolute inset-x-3 bottom-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
          <FenceCard fence={selectedFence} selected={false}>
            <View className="mt-2 flex-row gap-2">
              {canEditFences ? <Button title="Edit" variant="secondary" icon="edit-2" className="h-10 flex-1" onPress={() => editFence(selectedFence.id)} /> : null}
              <Button title="Close" variant="secondary" className="h-10 flex-1" onPress={() => selectFence(null)} />
            </View>
          </FenceCard>
        </View>
      ) : null}
    </View>
  )

  if (!twoPane) return <Screen top>{map}</Screen>

  // wide screens: the map, with the helmets or the fences in a panel on the right
  return (
    <Screen>
      <View className="flex-1 flex-row">
        {map}
        <View className="border-l border-slate-200 bg-slate-50" style={{ width: PANEL_WIDTH }}>
          {canFences ? (
            <View className="flex-row gap-2 px-4 pt-3">
              {(['helmets', 'fences'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityState={{ selected: panelTab === tab }}
                  onPress={() => setPanelTab(tab)}
                  className={cn('rounded-full border px-4 py-1.5', panelTab === tab ? 'border-brand-primary bg-brand-primary' : 'border-slate-300 bg-white')}
                >
                  <Text className={cn('font-sans-medium text-sm', panelTab === tab ? 'text-white' : 'text-slate-700')}>{tab === 'helmets' ? 'Helmets' : 'Fences'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {canFences && panelTab === 'fences' ? (
            <FenceListPanel
              selectedId={fenceId}
              onSelect={(id) => {
                selectFence(id)
                select(null)
              }}
            />
          ) : selected ? (
            <View className="flex-1">
              <Pressable accessibilityRole="button" onPress={() => select(null)} hitSlop={8} className="flex-row items-center gap-1 px-4 pb-1 pt-4">
                <Feather name="chevron-left" size={18} color="#0A6659" />
                <Text className="font-sans-semibold text-sm text-brand-primary">All helmets</Text>
              </Pressable>
              <HelmetDetailView key={selected.id} id={selected.id} embedded />
            </View>
          ) : (
            <View className="flex-1">
              <View className="px-4 pb-1 pt-4">
                <Text className="font-display-bold text-xl">Helmets</Text>
                <Text className="mt-0.5 text-xs text-slate-500">{placed.length} on the map · tap one to see it</Text>
              </View>
              <FlatList
                data={listed}
                keyExtractor={(d) => d.id}
                renderItem={({ item }) => <DeviceCard device={item} now={now} selected={false} onOpen={select} />}
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
