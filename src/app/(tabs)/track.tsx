import { useBrandColours } from '@/modules/branding/hooks/useBranding'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, Switch, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Button } from '@/shared/components/Button'
import { PageTitle } from '@/shared/components/PageTitle'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { useLayout } from '@/shared/lib/layout'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { MapSurface } from '@/modules/map/components/MapSurface'
import type { MapTrack } from '@/modules/map/types'
import { PlaybackBar } from '@/modules/track/components/PlaybackBar'
import { HelmetPicker, RangePicker } from '@/modules/track/components/TrackControls'
import { AvailabilityChart, TrackStats } from '@/modules/track/components/TrackSummary'
import { useTrack } from '@/modules/track/hooks/useTrack'
import { exportCsv } from '@/modules/track/lib/export'
import { presetDates, rangeFromDates } from '@/modules/track/lib/range'
import { segmentsOf, trackToCsv } from '@/modules/track/lib/track'

function Note({ children, tone }: { children: string; tone: 'amber' | 'slate' | 'red' }) {
  return (
    <Text
      className={cn(
        'rounded-xl p-3 text-sm leading-5',
        tone === 'amber' && 'bg-amber-50 text-amber-900',
        tone === 'slate' && 'bg-slate-100 text-slate-600',
        tone === 'red' && 'bg-red-50 text-red-700'
      )}
    >
      {children}
    </Text>
  )
}

function TrackScreen() {
  const brand = useBrandColours()
  const { deviceId: paramId } = useLocalSearchParams<{ deviceId?: string }>()
  const { devices } = useDeviceViews()
  const { twoPane } = useLayout()

  const [deviceId, setDeviceId] = useState<string | null>(paramId ?? null)
  const initial = useMemo(() => presetDates('7d'), [])
  const [fromDate, setFromDate] = useState(initial.fromDate)
  const [toDate, setToDate] = useState(initial.toDate)
  const [rangeError, setRangeError] = useState<string | null>(null)
  // Set when View is pressed, so editing the dates doesn't fire requests.
  const [requested, setRequested] = useState<{ from: number; to: number } | null>(() => {
    if (!paramId) return null
    const r = rangeFromDates(initial.fromDate, initial.toDate)
    return 'error' in r ? null : r
  })
  const [includeApproximate, setIncludeApproximate] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const [exportNote, setExportNote] = useState<string | null>(null)

  const selected = devices.find((d) => d.id === deviceId) ?? null
  const { track, availability, isFetching, isError, isForbidden } = useTrack(
    deviceId,
    requested?.from ?? 0,
    requested?.to ?? 0,
    requested !== null,
    includeApproximate
  )

  // This is a tab, so it stays mounted: "Replay route" on another helmet arrives as a changed parameter.
  useEffect(() => {
    if (!paramId) return
    setDeviceId(paramId)
    // The last 7 days as of now: this screen may have been open for
    // hours, so the window from when it first appeared is stale.
    const fresh = presetDates('7d')
    setFromDate(fresh.fromDate)
    setToDate(fresh.toDate)
    const r = rangeFromDates(fresh.fromDate, fresh.toDate)
    if (!('error' in r)) setRequested(r)
  }, [paramId])

  useEffect(() => {
    setCursor(0)
    setPlaying(false)
  }, [track])

  const mapTrack = useMemo<MapTrack | null>(() => {
    if (!track || track.points.length === 0) return null
    const first = track.points[0]
    const last = track.points[track.points.length - 1]
    return {
      segments: segmentsOf(track.points).map((run) => run.map((p): [number, number] => [p.lat, p.lng])),
      start: [first.lat, first.lng],
      end: track.points.length > 1 ? [last.lat, last.lng] : null,
    }
  }, [track])

  const point = track?.points[cursor]
  const cursorAt = useMemo<[number, number] | null>(() => (point ? [point.lat, point.lng] : null), [point])

  function view() {
    const r = rangeFromDates(fromDate, toDate)
    if ('error' in r) {
      setRangeError(r.error)
      return
    }
    setRangeError(null)
    setExportNote(null)
    setRequested(r)
  }

  async function exportIt() {
    if (!track || !selected) return
    const result = await exportCsv(`track-${selected.id}-${fromDate}-to-${toDate}.csv`, trackToCsv(track, selected.name))
    setExportNote(result === 'downloaded' ? 'Downloaded.' : result === 'shared' ? 'Shared.' : null)
  }

  const hasRoute = !!track && track.points.length > 0

  const controls = (
    <View className="gap-4">
      <PageTitle title="Track playback" padded={false} />
      <HelmetPicker
        devices={devices}
        selectedId={deviceId}
        compact={!twoPane}
        onSelect={(id) => {
          setDeviceId(id)
          setRequested(null)
        }}
      />
      <RangePicker fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} error={rangeError} />
      <View className="flex-row gap-2">
        <Button title={isFetching ? 'Loading…' : 'View'} icon="eye" className="flex-1" loading={isFetching} disabled={!deviceId} onPress={view} />
        <Button title="Export" variant="secondary" icon="download" className="flex-1" disabled={!hasRoute} onPress={() => void exportIt()} />
      </View>
      {exportNote ? <Text className="-mt-2 text-xs text-emerald-700">{exportNote}</Text> : null}
      {!deviceId ? <Note tone="slate">Choose a helmet to see where it has been.</Note> : null}
    </View>
  )

  const results = (
    <View className="gap-4">
      {isForbidden ? <Note tone="amber">Your role can't see this helmet's history.</Note> : null}
      {isError && !isForbidden ? <Note tone="red">Failed to load this track.</Note> : null}

      {track && track.points.length === 0 ? (
        <Note tone="slate">
          {`No position fixes recorded for ${selected?.name ?? 'this helmet'} in that period${
            track.stats.approximateExcluded > 0 ? ' (apart from approximate ones, which are hidden)' : ''
          }, so there is no route to replay. The chart below still shows when it was reporting.`}
        </Note>
      ) : null}

      {hasRoute ? (
        <>
          {track.stats.impossibleJumps > 0 ? (
            <Note tone="amber">
              {`${track.stats.impossibleJumps} position ${track.stats.impossibleJumps === 1 ? 'fix was' : 'fixes were'} excluded as physically impossible: a jump too far to have been travelled in the time.`}
            </Note>
          ) : null}
          {track.truncated ? (
            <Note tone="amber">
              This range has too many readings to load in full, so only the most recent part is shown. Choose a shorter period for the complete track.
            </Note>
          ) : null}
          <TrackStats track={track} />
        </>
      ) : null}

      {track ? (
        <View className="flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <View className="flex-1">
            <Text className="font-sans-medium text-sm">Show approximate positions</Text>
            <Text className="mt-0.5 text-xs leading-4 text-slate-500">
              {includeApproximate
                ? 'Including indoor positions from the mobile network or Wi-Fi, which can be hundreds of metres off.'
                : track.stats.approximateExcluded > 0
                  ? `${track.stats.approximateExcluded} indoor ${track.stats.approximateExcluded === 1 ? 'position is' : 'positions are'} hidden: they can be hundreds of metres off.`
                  : 'Indoor positions from the mobile network or Wi-Fi are hidden when there are any.'}
            </Text>
          </View>
          <Switch accessibilityLabel="Show approximate positions" value={includeApproximate} onValueChange={setIncludeApproximate} trackColor={{ false: '#CBD5E1', true: brand.primary }} />
        </View>
      ) : null}
    </View>
  )

  const playback = hasRoute ? (
    <PlaybackBar track={track} cursor={cursor} setCursor={setCursor} playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} />
  ) : null

  // On a wide screen the playback bar floats over the bottom of the map, so the route is fitted above it.
  const map = <MapSurface track={mapTrack} cursor={cursorAt} fitInsetBottom={twoPane && hasRoute ? 250 : 0} />

  if (twoPane) {
    return (
      <Screen>
        <View className="flex-1 flex-row">
          <ScrollView className="border-r border-slate-200 bg-slate-50" style={{ width: 400 }} contentContainerClassName="gap-4 px-4 pb-10 pt-4" keyboardShouldPersistTaps="handled">
            {controls}
            {results}
            {availability ? <AvailabilityChart summary={availability} /> : null}
          </ScrollView>
          <View className="flex-1">
            {map}
            {playback ? <View className="absolute inset-x-4 bottom-4">{playback}</View> : null}
            {!hasRoute ? (
              <View pointerEvents="none" className="absolute inset-x-0 top-6 items-center">
                <Text className="rounded-full bg-white px-4 py-2 text-sm text-slate-500 shadow-sm">The route appears here</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-4 px-4 pb-10 pt-3" keyboardShouldPersistTaps="handled">
        {controls}
        {results}
        {hasRoute ? <View style={{ height: 320 }} className="overflow-hidden rounded-2xl border border-slate-200">{map}</View> : null}
        {playback}
        {availability ? <AvailabilityChart summary={availability} /> : null}
      </ScrollView>
    </Screen>
  )
}

export default function TrackRoute() {
  return (
    <RequirePermission permission="trackPlayback:read" fallback="/more">
      <TrackScreen />
    </RequirePermission>
  )
}
