import { Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import type { DeviceView } from '@/modules/devices/types'
import { toggleId } from '../lib/roster'

const DOT = { online: 'bg-emerald-500', degraded: 'bg-amber-400', offline: 'bg-slate-300' } as const

/** The helmets to include. Groups hold administrators, not helmets, so the helmets are chosen each time. */
export function RosterPicker({ devices, roster, onChange }: { devices: DeviceView[]; roster: string[]; onChange: (next: string[]) => void }) {
  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm text-slate-500">{roster.length} selected</Text>
        <View className="flex-row gap-4">
          <Pressable hitSlop={8} onPress={() => onChange(devices.map((d) => d.id))}>
            <Text className="font-sans-medium text-sm text-brand-primary">Select all</Text>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => onChange([])}>
            <Text className="font-sans-medium text-sm text-slate-600">Clear</Text>
          </Pressable>
        </View>
      </View>
      <View className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {devices.map((d, i) => {
          const on = roster.includes(d.id)
          return (
            <Pressable
              key={d.id}
              accessibilityRole="checkbox"
              accessibilityLabel={d.name}
              accessibilityState={{ checked: on }}
              aria-checked={on}
              onPress={() => onChange(toggleId(roster, d.id))}
              className={cn('min-h-12 flex-row items-center gap-3 px-3 py-2.5 active:bg-slate-50', i > 0 && 'border-t border-slate-100')}
            >
              <View className={cn('h-5 w-5 items-center justify-center rounded border', on ? 'border-brand-primary bg-brand-primary' : 'border-slate-300')}>
                {on ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
              </View>
              <View className={cn('h-2 w-2 rounded-full', DOT[d.presence])} />
              <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>{d.name}</Text>
              <Text className="font-mono text-xs text-slate-400">{d.id.slice(-6)}</Text>
              {!d.active ? (
                <View className="rounded bg-slate-100 px-1.5 py-0.5"><Text className="text-[10px] text-slate-500">Inactive</Text></View>
              ) : null}
            </Pressable>
          )
        })}
      </View>
      <Text className="mt-2 text-xs leading-5 text-slate-500">
        Offline helmets still receive the message; it plays when they reconnect. Deactivated ones are skipped.
      </Text>
    </View>
  )
}
