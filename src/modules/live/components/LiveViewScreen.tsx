import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { Stack, router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { Screen } from '@/shared/components/Screen'
import { Text } from '@/shared/components/Text'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { endLiveForEveryone } from '../api/live.api'
import { useHelmetSession } from '../hooks/useHelmetSession'
import { SessionMessage, StatusPill } from './SessionPanel'
import { StreamView } from './StreamView'

/**
 * Watching one helmet's camera. Closing it only closes this tablet's connection: others may be watching, and the
 * helmet stops by itself about 20 seconds after the last viewer leaves. Ending it for everyone is a separate,
 * confirmed choice. The sound starts off; one tap turns it on.
 */
export function LiveViewScreen({ deviceId }: { deviceId: string }) {
  const { devices } = useDeviceViews()
  const name = devices.find((d) => d.id === deviceId)?.name ?? 'the helmet'
  const { session, state, begin } = useHelmetSession(deviceId)
  const [muted, setMuted] = useState(true)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => begin('watch'), 0)
    return () => clearTimeout(timer)
  }, [begin])

  const status = state?.status ?? 'starting'
  const live = status === 'live' || status === 'reconnecting'

  async function endForEveryone() {
    setEnding(true)
    try {
      await endLiveForEveryone(deviceId)
    } catch {
      /* the screen closes either way; the helmet also stops by itself */
    } finally {
      if (router.canGoBack()) router.back()
    }
  }

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: `Live: ${name}` }} />
      <View className="flex-1 bg-brand-secondary p-4">
        <View className="mb-3 flex-row items-center gap-2.5">
          <StatusPill status={status} />
          <Text className="min-w-0 flex-1 font-sans-semibold text-base text-white" numberOfLines={1}>{name}</Text>
        </View>

        <View className="flex-1 overflow-hidden rounded-2xl bg-black">
          <StreamView stream={state?.remoteStream ?? null} muted={muted} />
          {state && !live ? (
            <View className="absolute inset-0 items-center justify-center p-6">
              <SessionMessage state={state} name={name} onRetry={() => session?.retry()} onStartAgain={() => begin('watch')} />
            </View>
          ) : null}
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !muted, disabled: !live }}
            aria-pressed={!muted}
            disabled={!live}
            onPress={() => setMuted((m) => !m)}
            className="min-h-11 flex-row items-center gap-2 rounded-xl bg-white/10 px-4 active:bg-white/20"
            style={{ opacity: live ? 1 : 0.4 }}
          >
            <Feather name={muted ? 'volume-x' : 'volume-2'} size={18} color="#FFFFFF" />
            <Text className="text-sm text-white">{muted ? 'Turn sound on' : 'Mute'}</Text>
          </Pressable>
          <Button title="Close" variant="secondary" className="h-11 px-6" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </View>

        {confirmEnd ? (
          <View className="mt-3 gap-3 rounded-xl bg-white/10 p-3">
            <Text className="text-sm text-white">Stop the helmet streaming for everyone watching it?</Text>
            <View className="flex-row gap-2">
              <Button title={ending ? 'Ending…' : 'End stream'} className="h-11 flex-1" loading={ending} onPress={() => void endForEveryone()} />
              <Button title="Keep it running" variant="secondary" className="h-11 flex-1" disabled={ending} onPress={() => setConfirmEnd(false)} />
            </View>
          </View>
        ) : (
          <Text className="mt-3 text-xs leading-5 text-white/60">
            Others can watch this helmet at the same time. It stops streaming by itself about 20 seconds after the last viewer closes.{' '}
            <Text className="text-xs text-white underline" onPress={() => setConfirmEnd(true)}>End stream for everyone</Text>
          </Text>
        )}
      </View>
    </Screen>
  )
}
