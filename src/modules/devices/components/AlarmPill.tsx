import { View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import type { AlarmSeverity } from '@/modules/alarms/types'

export function AlarmPill({ severity }: { severity: AlarmSeverity }) {
  const critical = severity === 'critical'
  return (
    <View accessibilityLabel={critical ? 'Active alarm' : 'Active warning'} className={cn('flex-row items-center gap-1 rounded-full px-2 py-0.5', critical ? 'bg-red-50' : 'bg-amber-50')}>
      <Feather name="alert-triangle" size={11} color={critical ? '#DC2626' : '#D97706'} />
      <Text className={cn('font-sans-semibold text-xs', critical ? 'text-red-800' : 'text-amber-800')}>{critical ? 'Alarm' : 'Warning'}</Text>
    </View>
  )
}
