import { useEffect, useRef } from 'react'
import { Animated, Platform, Pressable, View } from 'react-native'
import { openCall } from '@/modules/calls/components/CallButton'
import { useCallAccess } from '@/modules/calls/hooks/useCallAccess'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/shared/components/Text'
import { lastSeenLabel } from '@/modules/devices/lib/presence'
import { cn } from '@/shared/lib/cn'
import { useLayout } from '@/shared/lib/layout'
import { useNow } from '@/shared/lib/useNow'
import { alarmLabel, isSos, type Alarm } from '../types'
import { useAlertStore } from '../store/alertStore'
import { openAlarm } from './AlarmCard'

/**
 * The persistent red banner, on every screen, for as long as a critical alarm
 * is unresolved and inside its 30-minute window.
 *
 * "Silence" stops the siren on this phone only; the banner stays until someone
 * resolves the alarm (which every open phone and dashboard hears about).
 * Opening an alarm silences it too, since that is what acknowledging means.
 *
 * A "Join call" button belongs here for SOS alarms; it arrives with calling.
 */
function JoinCall({ deviceId, onJoin }: { deviceId: string; onJoin: () => void }) {
  const { supported, access } = useCallAccess(deviceId)
  if (!supported || !access.allowed) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Join call"
      onPress={() => {
        onJoin()
        openCall(deviceId)
      }}
      className="h-10 flex-1 items-center justify-center rounded-xl border-2 border-white bg-red-700 active:bg-red-800"
    >
      <Text className="font-sans-bold text-sm text-white">Join call</Text>
    </Pressable>
  )
}

export function SosBanner({ alarms }: { alarms: Alarm[] }) {
  const insets = useSafeAreaInsets()
  // On a wide screen the text and buttons share one row, which keeps the banner short.
  const { wide } = useLayout()
  const now = useNow(10_000)
  const silenced = useAlertStore((s) => s.silenced)
  const silence = useAlertStore((s) => s.silence)
  const pulse = useRef(new Animated.Value(1)).current

  const ringing = alarms.some((a) => !silenced[a.id])

  useEffect(() => {
    if (!ringing) {
      pulse.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [ringing, pulse])

  if (alarms.length === 0) return null

  const latest = alarms[0]
  const more = alarms.length - 1

  return (
    <View
      testID="sos-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      className="bg-red-600 px-4 pb-3"
      style={{ paddingTop: insets.top + 10 }}
    >
      <View className={cn(wide && 'flex-row items-center gap-4')}>
        <View className="flex-1 flex-row items-center gap-3">
          <Animated.View style={{ opacity: pulse }} className="h-3 w-3 rounded-full bg-white" />
          <View className="flex-1">
            <Text className="font-sans-bold text-sm uppercase tracking-wider text-white" numberOfLines={1}>
              {alarmLabel(latest.type)}
            </Text>
            <Text className="text-sm text-white/90" numberOfLines={1}>
              {latest.deviceName} · {lastSeenLabel(latest.raisedAt, now)}
              {more > 0 ? ` · +${more} more` : ''}
            </Text>
          </View>
        </View>
        <View className={cn('flex-row gap-3', wide ? 'w-96' : 'mt-3')}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              silence(alarms.map((a) => a.id))
              openAlarm(latest.id)
            }}
            className="h-10 flex-1 items-center justify-center rounded-xl bg-white active:bg-red-100"
          >
            <Text className="font-sans-semibold text-sm text-red-700">View alarm</Text>
          </Pressable>
          {isSos(latest.type) ? <JoinCall deviceId={latest.deviceId} onJoin={() => silence(alarms.map((x) => x.id))} /> : null}
          {ringing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Silence siren"
              onPress={() => silence(alarms.map((a) => a.id))}
              className="h-10 flex-1 items-center justify-center rounded-xl border border-white/70 active:bg-red-700"
            >
              <Text className="font-sans-semibold text-sm text-white">Silence</Text>
            </Pressable>
          ) : (
            <View className="h-10 flex-1 items-center justify-center rounded-xl border border-white/30">
              <Text className="text-sm text-white/80">Siren silenced</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
