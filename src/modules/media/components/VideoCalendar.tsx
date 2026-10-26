import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { useVideoCalendar } from '../hooks/useMedia'
import { WEEKDAYS, dayKey, monthCells, monthKey, monthLabel, shiftMonth } from '../lib/calendar'
import { formatBytes } from '../types'

// A month of when recordings were made, by the helmet's recording date rather than the
// upload date (clips often upload days later and would land on the wrong day).
export function VideoCalendar({ deviceId, date, onDateChange }: { deviceId?: string; date?: string; onDateChange: (date: string | undefined) => void }) {
  const today = new Date()
  const thisMonth = monthKey(today)
  const todayKey = dayKey(thisMonth, today.getDate())
  const [month, setMonth] = useState(date?.slice(0, 7) ?? thisMonth)
  useEffect(() => {
    if (date) setMonth(date.slice(0, 7))
  }, [date])
  const { data, isLoading, isError } = useVideoCalendar(month, deviceId)
  const here = data?.month === month ? data : null
  const cells = monthCells(month)
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7))

  return (
    <View accessibilityLabel="Recordings calendar" className="rounded-xl border border-slate-200 bg-white p-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} onPress={() => setMonth(shiftMonth(month, -1))} className="h-10 w-10 items-center justify-center rounded-full active:bg-slate-100">
          <Feather name="chevron-left" size={20} color="#475569" />
        </Pressable>
        <View className="items-center">
          <Text className="font-sans-semibold text-sm">{monthLabel(month)}</Text>
          <Text accessibilityLiveRegion="polite" className="text-[11px] text-slate-400">
            {isError ? "Couldn't load this month" : isLoading || !here ? 'Loading…' : `${here.totalClips} ${here.totalClips === 1 ? 'clip' : 'clips'}`}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={month >= thisMonth} hitSlop={8} onPress={() => setMonth(shiftMonth(month, 1))} className="h-10 w-10 items-center justify-center rounded-full active:bg-slate-100" style={{ opacity: month >= thisMonth ? 0.3 : 1 }}>
          <Feather name="chevron-right" size={20} color="#475569" />
        </Pressable>
      </View>

      <View className="mb-1 flex-row">
        {WEEKDAYS.map((w) => <Text key={w} className="flex-1 py-1 text-center text-[10px] font-sans-medium text-slate-400">{w}</Text>)}
      </View>
      {rows.map((row, r) => (
        <View key={r} className="flex-row">
          {row.map((day, c) => {
            if (day === null) return <View key={c} className="flex-1" style={{ height: 50 }} />
            const key = dayKey(month, day)
            const info = here?.days[key]
            const selected = key === date
            return (
              <View key={c} className="flex-1 p-0.5" style={{ height: 50 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={info ? `${key}: ${info.count} ${info.count === 1 ? 'clip' : 'clips'}, ${formatBytes(info.totalBytes) ?? ''}` : `${key}: no clips`}
                  aria-pressed={selected}
                  disabled={!info && !selected}
                  onPress={() => onDateChange(selected ? undefined : key)}
                  className={cn('flex-1 items-center justify-center rounded-md', selected ? 'bg-brand-primary' : info ? 'bg-brand-tint active:bg-brand-soft' : '', key === todayKey && !selected && 'border border-slate-300')}
                >
                  <Text className={cn('text-xs', selected ? 'font-sans-semibold text-white' : info ? 'font-sans-medium text-slate-800' : 'text-slate-300')}>{day}</Text>
                  {info ? <Text className={cn('text-[9px] leading-3', selected ? 'text-white' : 'text-brand-primary')}>{info.count}</Text> : null}
                </Pressable>
              </View>
            )
          })}
        </View>
      ))}
      {date ? (
        <Pressable accessibilityRole="button" onPress={() => onDateChange(undefined)} className="mt-2 items-center rounded-lg py-2 active:bg-slate-50">
          <Text className="text-xs text-slate-500">Show all days</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
