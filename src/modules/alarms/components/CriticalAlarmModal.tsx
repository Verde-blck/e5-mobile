import { useEffect, useRef } from 'react'
import { Animated, Modal, Platform, Pressable, View } from 'react-native'
import { router } from 'expo-router'
import { openCall } from '@/modules/calls/components/CallButton'
import { useCallAccess } from '@/modules/calls/hooks/useCallAccess'
import { useDeviceById } from '@/modules/devices/hooks/useDevices'
import { lastSeenLabel } from '@/modules/devices/lib/presence'
import { Text } from '@/shared/components/Text'
import { useCan } from '@/shared/lib/permissions'
import { useNow } from '@/shared/lib/useNow'
import { useSelectionStore } from '@/shared/store/selectionStore'
import { useAwaitingAlarms } from '../hooks/useAlarms'
import { alarmDetail, alarmTitle, gasReadingLine, subjectLine } from '../lib/alarm-copy'
import { useAlertStore } from '../store/alertStore'
import { isSos } from '../types'

function JoinCallButton({ deviceId, onJoin }: { deviceId: string; onJoin: () => void }) {
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
      className="h-12 min-w-[140px] flex-1 items-center justify-center rounded-xl border-2 border-white bg-red-700 active:bg-red-800"
    >
      <Text className="font-sans-bold text-base text-white">Join call</Text>
    </Pressable>
  )
}

// A critical alarm is an emergency, so it takes the middle of the screen, over everything, and stays until someone acts on it. Any of its
// buttons counts as acting: it stops that alarm's siren and brings up the next one waiting, if there is one.
export function CriticalAlarmModal() {
  const waiting = useAwaitingAlarms()
  const alarm = waiting[0]
  const device = useDeviceById(alarm?.deviceId)
  const silence = useAlertStore((s) => s.silence)
  const canOpenMap = useCan('map:read')
  const now = useNow(10_000)
  const pulse = useRef(new Animated.Value(1)).current

  const showing = !!alarm
  useEffect(() => {
    if (!showing) {
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
  }, [showing, pulse])

  if (!alarm) return null

  const acted = () => silence([alarm.id])
  const reading = gasReadingLine(alarm.type, device, now)

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={acted}>
      <View accessibilityViewIsModal className="flex-1 items-center justify-center bg-black/65 px-5">
        <View
          testID="alarm-modal"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          className="w-full max-w-[600px] rounded-3xl border-2 border-white/30 bg-red-600 p-7"
        >
          <View className="flex-row items-center gap-3">
            <Animated.View style={{ opacity: pulse }} className="h-3.5 w-3.5 rounded-full bg-white" />
            <Text className="font-sans-bold text-xs uppercase tracking-widest text-white/90">
              {waiting.length > 1 ? `Alarm 1 of ${waiting.length}` : 'Alarm'}
            </Text>
          </View>

          <Text testID="alarm-modal-title" className="mt-3 font-display text-4xl text-white" style={{ lineHeight: 42 }}>
            {alarmTitle(alarm.type)}
          </Text>
          <Text testID="alarm-modal-subject" className="mt-2 font-sans-semibold text-xl text-white">
            {subjectLine(alarm, device)}
          </Text>
          <Text testID="alarm-modal-detail" className="mt-3 text-base leading-6 text-white/95">
            {alarmDetail(alarm.type)}
          </Text>
          {reading ? <Text className="mt-1 font-sans-medium text-base text-white">{reading}</Text> : null}
          <Text className="mt-3 text-sm text-white/80">Raised {lastSeenLabel(alarm.raisedAt, now)}</Text>

          <View className="mt-6 flex-row flex-wrap gap-3">
            {canOpenMap ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View on map"
                onPress={() => {
                  acted()
                  useSelectionStore.getState().selectHelmet(alarm.deviceId)
                  router.navigate('/map')
                }}
                className="h-12 min-w-[140px] flex-1 items-center justify-center rounded-xl bg-white active:bg-red-100"
              >
                <Text className="font-sans-bold text-base text-red-700">View on map</Text>
              </Pressable>
            ) : null}
            {isSos(alarm.type) ? <JoinCallButton deviceId={alarm.deviceId} onJoin={acted} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={acted}
              className="h-12 min-w-[140px] flex-1 items-center justify-center rounded-xl border border-white/70 active:bg-red-700"
            >
              <Text className="font-sans-semibold text-base text-white">Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
