import { View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { cn } from '@/shared/lib/cn'
import { Text } from '@/shared/components/Text'

export const LOW_BATTERY_PERCENT = 20

export function BatteryChip({ percent }: { percent: number | undefined }) {
  const low = percent !== undefined && percent < LOW_BATTERY_PERCENT
  return (
    <View className="flex-row items-center gap-1">
      <Feather
        name="battery"
        size={14}
        color={low ? '#DC2626' : '#64748B'}
      />
      <Text
        className={cn('text-xs', low ? 'font-sans-semibold text-red-600' : 'text-slate-600')}
      >
        {percent === undefined ? '—' : `${Math.round(percent)}%`}
      </Text>
    </View>
  )
}
