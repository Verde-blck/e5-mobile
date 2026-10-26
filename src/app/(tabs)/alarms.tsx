import { useBrandColours } from '@/modules/branding/hooks/useBranding'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { PageTitle } from '@/shared/components/PageTitle'
import { Screen } from '@/shared/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { CONTENT_MAX_DP, listPaneWidth, useLayout } from '@/shared/lib/layout'
import { useSelectionStore } from '@/shared/store/selectionStore'
import { AlarmCard } from '@/modules/alarms/components/AlarmCard'
import { AlarmDetailView } from '@/modules/alarms/components/AlarmDetailView'
import { useAlarms } from '@/modules/alarms/hooks/useAlarms'

type View_ = 'active' | 'history'

function AlarmsScreen() {
  const brand = useBrandColours()
  const { alarms, active, now, isLoading, isError, isForbidden, isRefetching, refetch } = useAlarms()
  const { width, twoPane } = useLayout()
  const selectedId = useSelectionStore((s) => s.alarmId)
  const select = useSelectionStore((s) => s.selectAlarm)
  const [view, setView] = useState<View_>('active')

  const history = useMemo(() => alarms.filter((a) => a.status === 'resolved'), [alarms])
  const shown = view === 'active' ? active : history

  const tabs: Array<{ key: View_; label: string; count: number }> = [
    { key: 'active', label: 'Active', count: active.length },
    { key: 'history', label: 'History', count: history.length },
  ]

  const cap = twoPane ? undefined : { width: '100%' as const, maxWidth: CONTENT_MAX_DP, alignSelf: 'center' as const }

  const list = (
    <>
      <View className="px-4 pb-2 pt-4" style={cap}>
        <PageTitle title="Alarm Record" padded={false} />
        <View className="flex-row rounded-xl bg-slate-200/70 p-1">
          {tabs.map(({ key, label, count }) => {
            const selected = view === key
            return (
              <Pressable
                key={key}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setView(key)}
                className={cn(
                  'h-9 flex-1 items-center justify-center rounded-lg',
                  selected && 'bg-white shadow-sm'
                )}
              >
                <Text
                  className={cn(
                    'font-sans-semibold text-sm',
                    selected ? 'text-slate-900' : 'text-slate-500'
                  )}
                >
                  {label} {count}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {isLoading ? (
        <LoadingState label="Loading alarms…" />
      ) : isForbidden ? (
        <EmptyState
          icon="lock"
          title="No access to the alarm record"
          hint="Your role doesn't include it. Live SOS alerts still reach you."
        />
      ) : isError && alarms.length === 0 ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <FlatList
          style={cap}
          data={shown}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <AlarmCard
              alarm={item}
              now={now}
              selected={twoPane && item.id === selectedId}
              onOpen={twoPane ? select : undefined}
            />
          )}
          contentContainerClassName="px-4 pb-8 pt-2"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={brand.primary}
              colors={[brand.primary]}
            />
          }
          ListEmptyComponent={
            view === 'active' ? (
              <EmptyState icon="check-circle" title="No active alarms" hint="New alarms appear here the moment a helmet raises one." />
            ) : (
              <EmptyState icon="clock" title="No history yet" hint="Resolved alarms are kept here." />
            )
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
            <AlarmDetailView key={selectedId} id={selectedId} embedded />
          ) : (
            <EmptyState
              icon="bell"
              title="Select an alarm"
              hint="Its details, photos and clips open here."
            />
          )}
        </View>
      </View>
    </Screen>
  )
}

export default function AlarmsRoute() {
  return (
    <RequirePermission permission="alarms:read" fallback="/more">
      <AlarmsScreen />
    </RequirePermission>
  )
}
