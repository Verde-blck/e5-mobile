import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'
import { useDeviceById } from '@/modules/devices/hooks/useDevices'
import { alarmDetail, alarmTitle, subjectLine } from '../lib/alarm-copy'
import { useAlertStore } from '../store/alertStore'
import { ALARM_ICONS } from './alarm-style'
import { openAlarm } from './AlarmCard'

const BANNER_MS = 6_000

// A warning is not an emergency, so it is small and goes by itself: the alarm is still in the list.
export function WarningBanner() {
  const banner = useAlertStore((s) => s.banner)
  const dismiss = useAlertStore((s) => s.dismissBanner)
  const device = useDeviceById(banner?.alarm.deviceId)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(dismiss, BANNER_MS)
    return () => clearTimeout(timer)
  }, [banner, dismiss])

  if (!banner) return null
  const { alarm } = banner

  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 top-0 items-center px-4" style={{ paddingTop: insets.top + 8 }}>
      <Pressable
        testID="warning-banner"
        accessibilityRole="alert"
        onPress={() => {
          dismiss()
          openAlarm(alarm.id)
        }}
        className="w-full max-w-[480px] flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-white px-3.5 py-3 shadow-lg"
      >
        <View className="h-9 w-9 items-center justify-center rounded-full bg-amber-50">
          <Feather name={ALARM_ICONS[alarm.type]} size={17} color="#D97706" />
        </View>
        <View className="flex-1">
          <Text testID="warning-title" className="font-sans-semibold text-sm" numberOfLines={1}>
            {alarmTitle(alarm.type)}
          </Text>
          <Text className="text-xs text-slate-700" numberOfLines={1}>
            {subjectLine(alarm, device)}
          </Text>
          <Text className="text-xs text-slate-500" numberOfLines={1}>
            {alarmDetail(alarm.type)}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color="#94A3B8" />
      </Pressable>
    </View>
  )
}
