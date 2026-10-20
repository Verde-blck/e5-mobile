import { View } from 'react-native'
import { Card } from '@/shared/components/Card'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { formatUptime, type AvailabilitySummary } from '../lib/availability'
import { formatDistance, formatDuration } from '../lib/track'
import type { Track } from '../types'

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View className="rounded-xl border border-slate-200 bg-white p-3" style={{ flexGrow: 1, flexBasis: 120 }}>
      <Text className="text-[11px] text-slate-500">{label}</Text>
      <Text className={cn('mt-0.5 font-sans-semibold text-sm', warn ? 'text-amber-700' : 'text-slate-900')}>{value}</Text>
    </View>
  )
}

export function TrackStats({ track }: { track: Track }) {
  const { stats } = track
  return (
    <View className="flex-row flex-wrap gap-2">
      <Stat label="Distance" value={formatDistance(stats.distanceMetres)} />
      <Stat label="Time span" value={formatDuration(stats.durationMs)} />
      <Stat label="Moving" value={formatDuration(stats.movingMs)} />
      <Stat label="Top speed" value={`${stats.maxSpeedMps.toFixed(1)} m/s`} />
      <Stat label="Longest gap" value={stats.longestGapMs > 0 ? formatDuration(stats.longestGapMs) : 'None'} warn={stats.longestGapMs > 0} />
      <Stat label="Segments" value={String(stats.segments)} warn={stats.segments > 1} />
    </View>
  )
}

function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/**
 * Uptime rather than location: was this helmet switched on and reporting? It sits beside the route
 * because the two answer different questions: the route is for incidents, this is for compliance.
 */
export function AvailabilityChart({ summary }: { summary: AvailabilitySummary }) {
  const { days } = summary
  if (days.length === 0) return null

  const peak = Math.max(...days.map((d) => d.availableMs), 60_000)
  // Round the axis up to a whole hour so the scale reads cleanly.
  const axisMax = Math.ceil(peak / 3_600_000) * 3_600_000
  const ratio = summary.rangeMs > 0 ? summary.totalAvailableMs / summary.rangeMs : 0
  const tone = ratio >= 0.5 ? 'bg-emerald-500' : ratio >= 0.2 ? 'bg-amber-500' : 'bg-red-500'
  const BAR_AREA = 110

  return (
    <Card>
      <Text className="mb-1 font-sans-semibold text-sm">Available online</Text>
      <Text className="text-xs text-slate-500">Reporting time per day</Text>

      <View className="mt-3 flex-row items-end gap-3">
        <View className="flex-1">
          <View style={{ height: BAR_AREA }} className="flex-row items-end gap-0.5 border-b border-slate-200" accessibilityLabel="Time online per day over the selected period">
            {days.map((day) => (
              <View key={day.dayStart} className="flex-1 items-center justify-end" style={{ height: BAR_AREA }}>
                <View
                  className="w-full max-w-5 rounded-t bg-brand-primary"
                  style={{ height: Math.max(day.availableMs > 0 ? 2 : 0, (day.availableMs / axisMax) * BAR_AREA) }}
                />
              </View>
            ))}
          </View>
          <View className="mt-1 flex-row justify-between">
            <Text className="text-[11px] text-slate-400">{dayLabel(days[0].dayStart)}</Text>
            <Text className="text-[11px] text-slate-400">axis to {formatUptime(axisMax)}</Text>
            <Text className="text-[11px] text-slate-400">{dayLabel(days[days.length - 1].dayStart)}</Text>
          </View>
        </View>
      </View>

      <View className="mt-3">
        <View className="flex-row items-baseline justify-between">
          <Text className="font-display-bold text-xl">{formatUptime(summary.totalAvailableMs)}</Text>
          <Text className="text-xs text-slate-500">{Math.round(ratio * 100)}% of the period</Text>
        </View>
        <View className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
          <View className={cn('h-2 rounded-full', tone)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </View>
      </View>

      <Text className="mt-3 text-[11px] leading-4 text-slate-400">
        Counted from the spacing between reports, which arrive roughly every {Math.round(summary.medianIntervalMs / 1000)}s on this
        helmet. A silence longer than {Math.round(summary.toleranceMs / 60_000)} min counts as offline.
      </Text>
    </Card>
  )
}
