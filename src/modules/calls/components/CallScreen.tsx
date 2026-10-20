import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { useNow } from '@/shared/lib/useNow'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { StreamView } from '@/modules/live/components/StreamView'
import { SessionMessage, StatusPill } from '@/modules/live/components/SessionPanel'
import { useHelmetSession } from '@/modules/live/hooks/useHelmetSession'
import { formatCallTime } from '@/modules/live/lib/format'
import { useCallAccess } from '../hooks/useCallAccess'

function close() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

function RoundButton({ icon, label, on, onPress, danger, size = 64, disabled }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; on?: boolean; onPress: () => void; danger?: boolean; size?: number; disabled?: boolean }) {
  return (
    <View className="items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!on, disabled }}
        aria-pressed={on}
        disabled={disabled}
        onPress={onPress}
        style={{ width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.4 : 1 }}
        className={cn('items-center justify-center', danger ? 'bg-red-600 active:bg-red-700' : on ? 'bg-white active:bg-slate-200' : 'bg-white/15 active:bg-white/25')}
      >
        <Feather name={icon} size={size / 2.6} color={danger ? '#FFFFFF' : on ? '#0C352F' : '#FFFFFF'} />
      </Pressable>
      <Text className="text-xs text-white/80">{label}</Text>
    </View>
  )
}

/**
 * A call with one helmet: its picture and sound, the timer, mute and hang up. Voice only from this side: the tablet
 * shows the helmet's camera and never uses its own. It starts by itself when this account is allowed to, and ends
 * when you leave, including leaving the app for more than a few seconds.
 */
export function CallScreen({ deviceId }: { deviceId: string }) {
  const insets = useSafeAreaInsets()
  const { devices } = useDeviceViews()
  const name = devices.find((d) => d.id === deviceId)?.name ?? 'the helmet'
  const { supported, access } = useCallAccess(deviceId)
  const { session, state, begin, end } = useHelmetSession(deviceId)
  const now = useNow(250) // four ticks a second, so the timer is never more than a quarter-second behind
  const canCall = supported && access.allowed

  // Started from a timer that an undo cancels, so a development double-run can't send the helmet start, stop, start.
  useEffect(() => {
    if (!canCall) return
    const timer = setTimeout(() => begin('call'), 0)
    return () => clearTimeout(timer)
  }, [canCall, begin])

  const sos = access.allowed && access.basis === 'sos'
  const status = state?.status ?? 'requesting-media'
  const live = status === 'live' || status === 'reconnecting'
  const over = status === 'ended'
  const lasted = state?.liveSince ? formatCallTime((over ? Date.now() : now) - state.liveSince) : null

  if (!canCall) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-secondary px-8" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Text className="text-center font-sans-semibold text-lg text-amber-300">{!supported ? "Calls aren't available yet" : "You can't call this helmet"}</Text>
        <Text className="mb-6 mt-2 text-center text-sm leading-5 text-white/80">
          {!supported ? 'This version of the app cannot place calls.' : 'Calls need the right permission, or an open SOS alarm for that helmet.'}
        </Text>
        <Button title="Close" variant="secondary" onPress={close} />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-brand-secondary" style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}>
      {sos ? (
        <View className="mx-4 mb-3 rounded-xl bg-red-600 px-4 py-2.5">
          <Text className="text-center text-sm font-sans-semibold text-white">SOS call · {name} has an open SOS alarm</Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between gap-3 px-4 pb-3">
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <StatusPill status={status} />
          <Text className="min-w-0 flex-1 font-sans-semibold text-base text-white" numberOfLines={1}>{name}</Text>
        </View>
        {lasted ? <Text className="font-mono text-sm text-white/70">{lasted}</Text> : null}
      </View>

      <View className="mx-4 flex-1 overflow-hidden rounded-2xl bg-black">
        <StreamView stream={state?.remoteStream ?? null} muted={false} />
        {state && !live && !over ? (
          <View className="absolute inset-0 items-center justify-center p-6">
            <SessionMessage state={state} name={name} onRetry={() => session?.retry()} onStartAgain={() => begin('call')} />
          </View>
        ) : null}
        {over ? (
          <View className="absolute inset-0 items-center justify-center bg-black/70 p-6">
            <Text className="text-center font-sans-semibold text-lg text-white">{state?.endReason === 'left-app' ? 'The call ended when you left the app' : 'Call ended'}</Text>
            {lasted ? <Text className="mt-1 text-sm text-white/70">It lasted {lasted}.</Text> : null}
          </View>
        ) : null}
      </View>

      {state?.outgoingFailed ? (
        <Text accessibilityRole="alert" className="mx-4 mt-3 rounded-xl bg-amber-500/15 px-4 py-2.5 text-xs leading-5 text-amber-200">
          Your voice isn’t reaching the helmet, so the wearer can’t hear you. Hang up and call again.
        </Text>
      ) : null}

      {over ? (
        <View className="mt-4 px-8">
          <Button title="Close" variant="secondary" onPress={close} />
        </View>
      ) : (
        <View className="mt-4 flex-row items-end justify-center gap-10 px-6">
          <RoundButton icon={state?.micOn === false ? 'mic-off' : 'mic'} label={state?.micOn === false ? 'Muted' : 'Mute'} on={state?.micOn === false} disabled={!state?.localStream} onPress={() => session?.toggleMic()} />
          <RoundButton icon="phone-off" label="Hang up" danger size={76} onPress={() => end()} />
        </View>
      )}
    </View>
  )
}
