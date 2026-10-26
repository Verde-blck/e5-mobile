import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { cn } from '@/shared/lib/cn'
import type { DeviceView } from '@/modules/devices/types'
import { PRESETS, presetDates, type RangePreset } from '../lib/range'

export function HelmetPicker({
  devices,
  selectedId,
  onSelect,
  compact,
}: {
  devices: DeviceView[]
  selectedId: string | null
  onSelect: (id: string) => void
  compact?: boolean
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const selected = devices.find((d) => d.id === selectedId)

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return needle ? devices.filter((d) => d.name.toLowerCase().includes(needle) || d.id.includes(needle)) : devices
  }, [devices, search])

  if (compact && selected && !open) {
    return (
      <View className="flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
        <View className="flex-1">
          <Text className="text-[11px] text-slate-500">Helmet</Text>
          <Text className="font-sans-semibold" numberOfLines={1}>{selected.name}</Text>
        </View>
        <Pressable hitSlop={8} accessibilityRole="button" onPress={() => setOpen(true)}>
          <Text className="font-sans-semibold text-sm text-brand-primary">Change</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      <TextField label="Helmet" value={search} onChangeText={setSearch} placeholder="Enter name or device ID" autoCapitalize="none" autoCorrect={false} />
      <View className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ maxHeight: 240 }}>
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {matches.map((d, i) => {
            const on = d.id === selectedId
            return (
              <Pressable
                key={d.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  onSelect(d.id)
                  setOpen(false)
                }}
                className={cn('px-3 py-2.5 active:bg-slate-50', i > 0 && 'border-t border-slate-100', on && 'bg-brand-tint')}
              >
                <Text className="font-sans-medium text-sm" numberOfLines={1}>{d.name}</Text>
                <Text className="font-mono text-[11px] text-slate-400">{d.id}</Text>
              </Pressable>
            )
          })}
          {matches.length === 0 ? <Text className="px-3 py-3 text-sm text-slate-500">No helmets match.</Text> : null}
        </ScrollView>
      </View>
    </View>
  )
}

export function RangePicker({
  fromDate,
  toDate,
  setFromDate,
  setToDate,
  error,
}: {
  fromDate: string
  toDate: string
  setFromDate: (v: string) => void
  setToDate: (v: string) => void
  error: string | null
}) {
  const apply = (preset: RangePreset) => {
    const { fromDate: from, toDate: to } = presetDates(preset)
    setFromDate(from)
    setToDate(to)
  }
  return (
    <View>
      <Text className="mb-1.5 font-sans-medium text-sm text-slate-700">Period</Text>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {PRESETS.map((p) => {
          const dates = presetDates(p.key)
          const on = dates.fromDate === fromDate && dates.toDate === toDate
          return (
            <Pressable key={p.key} hitSlop={6} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => apply(p.key)} className={cn('rounded-full border px-3.5 py-2', on ? 'border-brand-primary bg-brand-primary' : 'border-slate-300 bg-white')}>
              <Text className={cn('font-sans-medium text-sm', on ? 'text-white' : 'text-slate-700')}>{p.label}</Text>
            </Pressable>
          )
        })}
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <TextField label="From" value={fromDate} onChangeText={setFromDate} mono placeholder="2026-10-19" autoCapitalize="none" autoCorrect={false} maxLength={10} />
        </View>
        <View className="flex-1">
          <TextField label="To" value={toDate} onChangeText={setToDate} mono placeholder="2026-10-19" autoCapitalize="none" autoCorrect={false} maxLength={10} />
        </View>
      </View>
      {error ? <Text className="mt-1.5 text-sm text-red-600">{error}</Text> : null}
    </View>
  )
}
