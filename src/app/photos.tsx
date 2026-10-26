import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { DayField } from '@/modules/media/components/DayField'
import { DeviceFilter } from '@/modules/media/components/DeviceFilter'
import { PhotoGrid } from '@/modules/media/components/PhotoGrid'
import { useMediaList } from '@/modules/media/hooks/useMedia'
import { photoColumns } from '@/modules/media/lib/layout'
import type { MediaQuery } from '@/modules/media/types'

function PhotosScreen() {
  const queryClient = useQueryClient()
  const { devices } = useDeviceViews()
  const [query, setQuery] = useState<MediaQuery>({ kind: 'photo' })
  const [gridWidth, setGridWidth] = useState(0)
  const { media, isLoading, isFetching, isError, refetch } = useMediaList(query)
  const filtered = !!(query.deviceId || query.date)

  return (
    <Screen top={false}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-12 pt-3">
        <Container max={1100}>
          <View className="mb-3 flex-row justify-end">
            <Button title="Refresh" icon="refresh-cw" variant="secondary" className="h-10" loading={isFetching && !isLoading} onPress={() => void queryClient.invalidateQueries({ queryKey: ['media'] })} />
          </View>

          <View className="mb-4 gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <DeviceFilter devices={devices} value={query.deviceId} onChange={(deviceId) => setQuery({ ...query, deviceId })} />
            <DayField value={query.date} onChange={(date) => setQuery({ ...query, date })} />
            <View className="flex-row items-center justify-between">
              <Text accessibilityLiveRegion="polite" className="text-[11px] text-slate-400">
                {isFetching && !isLoading ? 'Searching…' : `${media.length} ${media.length === 1 ? 'result' : 'results'}`}
                {query.date ? ' · filtered by capture date, not upload date' : ''}
              </Text>
              {filtered ? <Text accessibilityRole="button" onPress={() => setQuery({ kind: 'photo' })} className="text-xs text-slate-500 underline">Clear</Text> : null}
            </View>
          </View>

          {isLoading ? <Text className="text-sm text-slate-500">Loading photos…</Text> : null}
          {isError ? (
            <View className="items-start gap-2">
              <Text accessibilityRole="alert" className="text-sm text-red-600">Failed to load photos.</Text>
              <Button title="Try again" variant="secondary" className="h-10" onPress={() => void refetch()} />
            </View>
          ) : null}
          <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
            {!isLoading && !isError ? (
              <PhotoGrid items={media} width={gridWidth} columns={photoColumns(gridWidth)} emptyMessage={filtered ? 'No photos match those filters.' : 'No photos captured yet.'} onLinkFailed={() => void queryClient.invalidateQueries({ queryKey: ['media'] })} />
            ) : null}
          </View>
        </Container>
      </ScrollView>
    </Screen>
  )
}

export default function PhotosRoute() {
  return (
    <RequirePermission permission="photos:read" fallback="/more">
      <PhotosScreen />
    </RequirePermission>
  )
}
