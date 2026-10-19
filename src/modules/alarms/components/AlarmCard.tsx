import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'
import { detailGoesInPane, isTwoPaneNow } from '@/shared/lib/layout'
import { useAuthStore } from '@/shared/store/authStore'
import { useSelectionStore } from '@/shared/store/selectionStore'
import { cn } from '@/shared/lib/cn'
import { lastSeenLabel } from '@/modules/devices/lib/presence'
import { alarmLabel, type Alarm } from '../types'
import { ALARM_ICONS, alarmTone } from './alarm-style'

/**
 * Opens an alarm from anywhere (the banner, a toast, a card). On a wide screen
 * it opens in the Alarms tab's right-hand pane; on a narrow one, as a full screen.
 */
export function openAlarm(id: string) {
  const canUseTab = useAuthStore.getState().user?.permissions.includes('alarms:read') ?? false
  if (detailGoesInPane(isTwoPaneNow(), canUseTab)) {
    useSelectionStore.getState().selectAlarm(id)
    router.navigate('/alarms')
  } else {
    router.push(`/alarm/${encodeURIComponent(id)}`)
  }
}

export function AlarmCard({
  alarm,
  now,
  selected,
  onOpen,
}: {
  alarm: Alarm
  now: number
  /** Highlighted when it's the one open in the side pane. */
  selected?: boolean
  /** Overrides the default navigation, e.g. to fill the side pane. */
  onOpen?: (id: string) => void
}) {
  const tone = alarmTone(alarm)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={`${alarmLabel(alarm.type)}, ${alarm.deviceName}, ${tone.label}`}
      onPress={() => (onOpen ? onOpen(alarm.id) : openAlarm(alarm.id))}
      className={cn(
        'mb-3 flex-row items-center gap-3 rounded-2xl border p-4 active:bg-slate-50',
        selected ? 'border-brand-primary bg-brand-tint' : 'border-slate-200 bg-white'
      )}
    >
      <View className={cn('h-11 w-11 items-center justify-center rounded-full', tone.bg)}>
        <Feather name={ALARM_ICONS[alarm.type]} size={20} color={tone.icon} />
      </View>
      <View className="flex-1">
        <Text className="font-sans-semibold text-base" numberOfLines={1}>
          {alarmLabel(alarm.type)}
        </Text>
        <Text className="mt-0.5 text-sm text-slate-600" numberOfLines={1}>
          {alarm.deviceName}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500">{lastSeenLabel(alarm.raisedAt, now)}</Text>
      </View>
      <View className={cn('rounded-full px-2.5 py-1', tone.pill)}>
        <Text className={cn('font-sans-medium text-xs', tone.pillText)}>{tone.label}</Text>
      </View>
    </Pressable>
  )
}
