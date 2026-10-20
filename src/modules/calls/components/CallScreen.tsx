import { useEffect, useRef } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { useNow } from '@/shared/lib/useNow'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { notifications } from '@/modules/push/lib/notifications'
import { useCall } from '../hooks/useCall'
import { useCallAccess } from '../hooks/useCallAccess'
import { callEngine } from '../lib/engines'
import { IDLE, describeCall, formatCallTime } from '../lib/callState'
import type { CallState } from '../types'

function close() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

function RoundButton({ icon, label, on, onPress, danger, size = 64 }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; on?: boolean; onPress: () => void; danger?: boolean; size?: number }) {
  return (
    <View className="items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!on }}
        aria-pressed={on}
        onPress={onPress}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className={cn('items-center justify-center', danger ? 'bg-red-600 active:bg-red-700' : on ? 'bg-white active:bg-slate-200' : 'bg-white/15 active:bg-white/25')}
      >
        <Feather name={icon} size={size / 2.6} color={danger ? '#FFFFFF' : on ? '#0C352F' : '#FFFFFF'} />
      </Pressable>
      <Text className="text-xs text-white/80">{label}</Text>
    </View>
  )
}

/**
 * A call with one helmet: who, what's happening, the timer, and the three controls. It starts the
 * call on its own when this account is allowed to, and ends it when you leave.
 */
export function CallScreen({ deviceId }: { deviceId: string }) {
  const insets = useSafeAreaInsets()
  const { devices } = useDeviceViews()
  const name = devices.find((d) => d.id === deviceId)?.name ?? 'the helmet'
  const { supported, access } = useCallAccess(deviceId)
  const { state, start, hangup, setMuted, setSpeaker } = useCall(deviceId)
  // Four ticks a second so the timer is never more than a quarter-second behind the real time.
  const now = useNow(250)
  const began = useRef(false)

  const canCall = supported && access.allowed
  useEffect(() => {
    if (canCall && !began.current) {
      began.current = true
      void start()
    }
  }, [canCall, start])

  // Not allowed (or no calling in this build): say so without ever contacting the helmet.
  const effective: CallState = !supported
    ? { ...IDLE, phase: 'failed', reason: 'failed', detail: 'Calls are not available in this build.' }
    : !access.allowed
      ? { ...IDLE, phase: 'failed', reason: 'not-allowed' }
      : state
  const copy = !supported
    ? { tone: 'warn' as const, title: "Calls aren't available yet", detail: 'This version of the app cannot place calls.', action: undefined }
    : describeCall(effective, name)

  const live = effective.phase === 'mic-permission' || effective.phase === 'connecting' || effective.phase === 'active'
  const over = !live

  return (
    <View className="flex-1 bg-brand-secondary" style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      {access.allowed && access.basis === 'sos' ? (
        <View className="mx-6 rounded-xl bg-red-600 px-4 py-2.5">
          <Text className="text-center text-sm font-sans-semibold text-white">SOS call · {name} has an open SOS alarm</Text>
        </View>
      ) : null}

      <View className="flex-1 items-center justify-center px-8">
        <View className="h-28 w-28 items-center justify-center rounded-full bg-white/15">
          <Feather name="user" size={48} color="#FFFFFF" />
        </View>
        <Text className="mt-6 text-center font-display-bold text-2xl text-white" numberOfLines={2}>{name}</Text>
        <Text
          accessibilityLiveRegion="polite"
          className={cn('mt-3 text-center font-sans-semibold text-lg', copy.tone === 'warn' ? 'text-amber-300' : 'text-white')}
        >
          {copy.title}
        </Text>
        {effective.phase === 'active' && effective.startedAt ? (
          <Text className="mt-1 font-mono text-3xl text-white">{formatCallTime(now - effective.startedAt)}</Text>
        ) : null}
        {copy.detail ? <Text className="mt-2 text-center text-sm leading-5 text-white/80">{copy.detail}</Text> : null}
        {effective.phase === 'failed' && effective.detail && effective.reason === 'failed' && supported ? (
          <Text className="mt-1 text-center text-xs text-white/60">{effective.detail}</Text>
        ) : null}
      </View>

      {live ? (
        <View className="flex-row items-end justify-center gap-8 px-6">
          <RoundButton icon={state.muted ? 'mic-off' : 'mic'} label={state.muted ? 'Muted' : 'Mute'} on={state.muted} onPress={() => setMuted(!state.muted)} />
          <RoundButton icon="phone-off" label="Hang up" danger size={76} onPress={() => void hangup()} />
          <RoundButton icon="volume-2" label="Speaker" on={state.speaker} onPress={() => setSpeaker(!state.speaker)} />
        </View>
      ) : null}

      {over ? (
        <View className="gap-3 px-8">
          {copy.action === 'retry' && canCall ? <Button title="Try again" icon="phone" onPress={() => void start()} /> : null}
          {copy.action === 'settings' ? <Button title="Open settings" icon="settings" onPress={() => void notifications.openSettings()} /> : null}
          <Button title="Close" variant="secondary" onPress={close} />
        </View>
      ) : null}
    </View>
  )
}

export const callsAvailable = () => callEngine.isSupported()
