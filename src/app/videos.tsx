import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { cn } from '@/shared/lib/cn'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { DayField } from '@/modules/media/components/DayField'
import { DeviceFilter } from '@/modules/media/components/DeviceFilter'
import { HelmetVideos } from '@/modules/media/components/HelmetVideos'
import { VideoCalendar } from '@/modules/media/components/VideoCalendar'
import { VideoList } from '@/modules/media/components/VideoList'
import { useMediaList } from '@/modules/media/hooks/useMedia'
import type { MediaQuery } from '@/modules/media/types'

type Tab = 'uploaded' | 'helmet'

/**
 * Video Record: the recordings that have reached the server, with a calendar of when they were made, and a second tab for
 * the clips still on a helmet's memory card (which you can ask it to upload).
 */
function VideosScreen() {
  const queryClient = useQueryClient()
  const { devices } = useDeviceViews()
  const [tab, setTab] = useState<Tab>('uploaded')
  const [query, setQuery] = useState<MediaQuery>({ kind: 'video' })
  const { media, isLoading, isFetching, isError, refetch } = useMediaList(query)
  // Recordings the helmet has flagged but not yet delivered. Worth surfacing, rather than leaving an operator to wonder why the list looks short.
  const pending = media.filter((m) => m.status === 'uploading').length
  const filtered = !!(query.deviceId || query.date || query.search)

  return (
    <Screen top={false}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-12 pt-3">
        <Container max={900}>
          <View className="mb-4 flex-row flex-wrap items-center justify-between gap-2">
            <View accessibilityRole="tablist" className="flex-row rounded-lg border border-slate-200 bg-white p-0.5">
              {([['uploaded', 'Uploaded'], ['helmet', 'Videos on helmet']] as const).map(([value, label]) => (
                <Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: tab === value }} aria-selected={tab === value} onPress={() => setTab(value)} className={cn('min-h-10 justify-center rounded-md px-3', tab === value ? 'bg-brand-tint' : 'active:bg-slate-50')}>
                  <Text className={cn('text-sm', tab === value ? 'font-sans-semibold text-slate-900' : 'text-slate-500')}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {tab === 'uploaded' ? <Button title="Refresh" icon="refresh-cw" variant="secondary" className="h-10" loading={isFetching && !isLoading} onPress={() => void queryClient.invalidateQueries({ queryKey: ['media'] })} /> : null}
          </View>

          {tab === 'helmet' ? (
            <HelmetVideos />
          ) : (
            <View>
              {pending > 0 ? <Text className="mb-4 self-start rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">{pending} still uploading from {pending === 1 ? 'a helmet' : 'helmets'}</Text> : null}

              <View className="mb-4 gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <DeviceFilter devices={devices} value={query.deviceId} onChange={(deviceId) => setQuery({ ...query, deviceId })} />
                <DayField value={query.date} onChange={(date) => setQuery({ ...query, date })} />
                <TextField label="File name" value={query.search ?? ''} onChangeText={(search) => setQuery({ ...query, search: search || undefined })} placeholder="Search recordings" autoCapitalize="none" autoCorrect={false} />
                <View className="flex-row items-center justify-between">
                  <Text accessibilityLiveRegion="polite" className="text-[11px] text-slate-400">
                    {isFetching && !isLoading ? 'Searching…' : `${media.length} ${media.length === 1 ? 'result' : 'results'}`}
                    {query.date ? ' · filtered by capture date, not upload date' : ''}
                  </Text>
                  {filtered ? <Text accessibilityRole="button" onPress={() => setQuery({ kind: 'video' })} className="text-xs text-slate-500 underline">Clear</Text> : null}
                </View>
              </View>

              <View className="mb-4">
                <VideoCalendar deviceId={query.deviceId} date={query.date} onDateChange={(date) => setQuery({ ...query, date })} />
              </View>

              {isLoading ? <Text className="text-sm text-slate-500">Loading recordings…</Text> : null}
              {isError ? (
                <View className="items-start gap-2">
                  <Text accessibilityRole="alert" className="text-sm text-red-600">Failed to load recordings.</Text>
                  <Button title="Try again" variant="secondary" className="h-10" onPress={() => void refetch()} />
                </View>
              ) : null}
              {!isLoading && !isError ? <VideoList items={media} onLinkFailed={() => void queryClient.invalidateQueries({ queryKey: ['media'] })} /> : null}
            </View>
          )}
        </Container>
      </ScrollView>
    </Screen>
  )
}

export default function VideosRoute() {
  return (
    <RequirePermission permission="videos:read" fallback="/more">
      <VideosScreen />
    </RequirePermission>
  )
}
