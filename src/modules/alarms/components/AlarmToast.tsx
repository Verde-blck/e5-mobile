import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'
import { useDeviceNames } from '@/modules/devices/hooks/useDevices'
import { alarmLabel } from '../types'
import { useAlertStore } from '../store/alertStore'
import { ALARM_ICONS } from './alarm-style'
import { openAlarm } from './AlarmCard'

const TOAST_MS = 6_000

export function AlarmToast() {
  const toast = useAlertStore((s) => s.toast)
  const dismiss = useAlertStore((s) => s.dismissToast)
  const names = useDeviceNames()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(dismiss, TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast, dismiss])

  if (!toast) return null
  const { alarm } = toast

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 top-0 px-4"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Pressable
        testID="alarm-toast"
        accessibilityRole="alert"
        onPress={() => {
          dismiss()
          openAlarm(alarm.id)
        }}
        className="flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-white p-3.5 shadow-lg"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-amber-50">
          <Feather name={ALARM_ICONS[alarm.type]} size={18} color="#D97706" />
        </View>
        <View className="flex-1">
          <Text className="font-sans-semibold text-sm" numberOfLines={1}>
            {alarmLabel(alarm.type)}
          </Text>
          <Text className="text-xs text-slate-600" numberOfLines={1}>
            {names.get(alarm.deviceId) ?? alarm.deviceName}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </Pressable>
    </View>
  )
}
