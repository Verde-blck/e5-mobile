import { Pressable, View } from 'react-native'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'

/** Which helmet: All devices, or one. Chips rather than a drop-down, so it is one tap and nothing is hidden. */
export function DeviceFilter({ devices, value, onChange, label = 'Device' }: { devices: { id: string; name: string }[]; value?: string; onChange: (id: string | undefined) => void; label?: string }) {
  const Chip = ({ id, name }: { id?: string; name: string }) => {
    const on = (value ?? undefined) === id
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        aria-pressed={on}
        onPress={() => onChange(id)}
        className={cn('min-h-9 justify-center rounded-full border px-3', on ? 'border-brand-primary bg-brand-tint' : 'border-slate-200 bg-white active:bg-slate-50')}
      >
        <Text className={cn('text-xs', on ? 'font-sans-semibold text-slate-900' : 'text-slate-600')}>{name}</Text>
      </Pressable>
    )
  }
  return (
    <View>
      <Text className="mb-1.5 text-xs text-slate-500">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip name="All devices" />
        {devices.map((d) => <Chip key={d.id} id={d.id} name={d.name} />)}
      </View>
    </View>
  )
}
