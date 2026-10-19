import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, TextInput, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { CONTENT_MAX_DP, listPaneWidth, useLayout } from '@/shared/lib/layout'
import { useSelectionStore } from '@/shared/store/selectionStore'
import { DeviceCard } from '@/modules/devices/components/DeviceCard'
import { HelmetDetailView } from '@/modules/devices/components/HelmetDetailView'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { PRESENCE_ORDER } from '@/modules/devices/lib/presence'
import type { Presence } from '@/modules/devices/types'

type Filter = 'all' | Presence

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'degraded', label: 'Degraded' },
  { key: 'offline', label: 'Offline' },
]

function MonitoringScreen() {
  const { devices, now, isLoading, isError, isRefetching, refetch } = useDeviceViews()
  const { width, twoPane } = useLayout()
  const selectedId = useSelectionStore((s) => s.helmetId)
  const select = useSelectionStore((s) => s.selectHelmet)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: devices.length, online: 0, degraded: 0, offline: 0 }
    devices.forEach((d) => (c[d.presence] += 1))
    return c
  }, [devices])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return devices
      .filter((d) => filter === 'all' || d.presence === filter)
      .filter(
        (d) => !needle || d.name.toLowerCase().includes(needle) || d.id.toLowerCase().includes(needle)
      )
      .sort(
        (a, b) =>
          PRESENCE_ORDER[a.presence] - PRESENCE_ORDER[b.presence] ||
          // "…57881" sorts before any letter; named helmets are what people look for.
          Number(a.named === false) - Number(b.named === false) ||
          a.name.localeCompare(b.name)
      )
  }, [devices, query, filter])

  const cap = twoPane ? undefined : { width: '100%' as const, maxWidth: CONTENT_MAX_DP, alignSelf: 'center' as const }

  const list = (
    <>
      <View className="px-4 pb-2 pt-4" style={cap}>
        <Text className="mb-4 font-display-bold text-2xl">Monitoring Center</Text>

        <View className="h-11 flex-row items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
          <Feather name="search" size={16} color="#94A3B8" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or device ID"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search helmets"
            className="flex-1 font-sans text-sm text-slate-900"
          />
          {query ? (
            <Pressable hitSlop={12} accessibilityLabel="Clear search" onPress={() => setQuery('')}>
              <Feather name="x-circle" size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => {
            const selected = filter === key
            return (
              <Pressable
                key={key}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFilter(key)}
                className={cn(
                  'rounded-full border px-3 py-1.5',
                  selected ? 'border-brand-primary bg-brand-primary' : 'border-slate-300 bg-white'
                )}
              >
                <Text
                  className={cn(
                    'font-sans-medium text-xs',
                    selected ? 'text-white' : 'text-slate-700'
                  )}
                >
                  {label} {counts[key]}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {isLoading ? (
        <LoadingState label="Loading helmets…" />
      ) : isError && devices.length === 0 ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <FlatList
          style={cap}
          data={visible}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <DeviceCard
              device={item}
              now={now}
              selected={twoPane && item.id === selectedId}
              onOpen={twoPane ? select : undefined}
            />
          )}
          contentContainerClassName="px-4 pb-8 pt-2"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor="#0A6659"
              colors={['#0A6659']}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title={devices.length === 0 ? 'No helmets yet' : 'No helmets match'}
              hint={
                devices.length === 0
                  ? 'Helmets appear here once they are registered.'
                  : 'Try a different search or filter.'
              }
            />
          }
        />
      )}
    </>
  )

  if (!twoPane) return <Screen>{list}</Screen>

  return (
    <Screen>
      <View className="flex-1 flex-row">
        <View className="border-r border-slate-200" style={{ width: listPaneWidth(width) }}>
          {list}
        </View>
        <View className="flex-1">
          {selectedId ? (
            <HelmetDetailView key={selectedId} id={selectedId} embedded />
          ) : (
            <EmptyState
              icon="shield"
              title="Select a helmet"
              hint="Its status, location and readings open here."
            />
          )}
        </View>
      </View>
    </Screen>
  )
}

export default function MonitoringRoute() {
  return (
    <RequirePermission permission="devices:read" fallback="/more">
      <MonitoringScreen />
    </RequirePermission>
  )
}
