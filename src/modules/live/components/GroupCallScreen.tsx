import { useEffect, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { useCan } from '@/shared/lib/permissions'
import { useNow } from '@/shared/lib/useNow'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { useGroupCall } from '../hooks/useGroupCall'
import { formatCallTime } from '../lib/format'
import type { Participant } from '../lib/groupSession'
import { wallColumns } from '../lib/wall'
import { RoundButton } from './RoundButton'
import { StreamView } from './StreamView'

const GAP = 8

function close() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

/** One helmet in the call. Everyone is audible, as on a call; any one can be muted. */
function HelmetTile({ participant, name, width, onRetry }: { participant: Participant; name: string; width: number; onRetry: () => void }) {
  const [muted, setMuted] = useState(false)
  const live = participant.status === 'live'
  return (
    <View style={{ width, aspectRatio: 16 / 9 }} className="overflow-hidden rounded-xl bg-black">
      <StreamView stream={participant.stream} muted={muted} />
      {!live ? (
        <View className="absolute inset-0 items-center justify-center p-3 pt-8">
          {participant.status === 'unreachable' ? (
            <Text className="text-center text-xs text-slate-300">Offline: not reachable</Text>
          ) : participant.status === 'failed' ? (
            <View className="items-center gap-2">
              <Text className="text-xs text-slate-300">No picture.</Text>
              <Button title="Try again" icon="refresh-cw" className="h-9" onPress={onRetry} />
            </View>
          ) : (
            <Text className="text-center text-xs text-slate-300">{participant.status === 'reconnecting' ? 'Signal dropped, reconnecting…' : 'Connecting…'}</Text>
          )}
        </View>
      ) : null}
      <View className="absolute inset-x-0 top-0 flex-row items-center justify-between gap-2 bg-black/55 px-2.5 py-1.5">
        <Text className="min-w-0 flex-1 font-sans-medium text-xs text-white" numberOfLines={1}>{name}</Text>
        {live ? (
          <Pressable accessibilityRole="button" accessibilityLabel={muted ? `Unmute ${name}` : `Mute ${name}`} aria-pressed={muted} onPress={() => setMuted((m) => !m)} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-md bg-white/15 active:bg-white/30">
            <Feather name={muted ? 'volume-x' : 'volume-2'} size={15} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

/**
 * A call with several helmets in one room: each helmet's picture and sound, your own tile, and mute, camera and hang up.
 * Hanging up ends it for every helmet. It starts by itself, and ends when you leave, including leaving the app for more
 * than a few seconds. Beta: it hasn't been tried with several real helmets.
 */
export function GroupCallScreen({ ids, video }: { ids: string[]; video: boolean }) {
  const insets = useSafeAreaInsets()
  const { devices } = useDeviceViews()
  const canGroup = useCan('groupCall:write')
  const names = new Map(devices.map((d) => [d.id, d.name]))
  const { session, state, begin, end } = useGroupCall()
  const now = useNow(250)
  const [gridWidth, setGridWidth] = useState(0)
  const idsKey = ids.join(',')

  // Started from a timer that an undo cancels, so a development double-run can't call every helmet twice.
  useEffect(() => {
    if (!canGroup || ids.length === 0) return
    const timer = setTimeout(() => begin(ids, video), 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGroup, idsKey, video, begin])

  if (!canGroup || ids.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-secondary px-8" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Text className="text-center font-sans-semibold text-lg text-amber-300">{ids.length === 0 ? 'No helmets chosen' : "You can't start a group call"}</Text>
        <Text className="mb-6 mt-2 text-center text-sm leading-5 text-white/80">{ids.length === 0 ? 'Choose at least one helmet first.' : "Group calls need the group call permission (the backend's GROUP_CALL)."}</Text>
        <Button title="Close" variant="secondary" onPress={close} />
      </View>
    )
  }

  const status = state?.status ?? 'requesting-media'
  const over = status === 'ended'
  const connected = state?.participants.filter((p) => p.status === 'live').length ?? 0
  const hasVideo = (state?.localStream?.getVideoTracks().length ?? 0) > 0
  const lasted = state?.startedAt ? formatCallTime((over ? Date.now() : now) - state.startedAt) : null
  const columns = wallColumns(gridWidth)
  const tileWidth = gridWidth ? Math.floor((gridWidth - GAP * (columns - 1)) / columns) : 0

  return (
    <View className="flex-1 bg-brand-secondary" style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}>
      <View className="flex-row flex-wrap items-center justify-between gap-2 px-4 pb-3">
        <View className="flex-row items-center gap-2.5">
          <Text accessibilityRole="header" className="font-sans-semibold text-base text-white">Group call</Text>
          <View className="rounded-full bg-white/10 px-2 py-0.5"><Text className="text-[11px] text-white/70">Beta</Text></View>
          {status === 'active' ? <Text className="text-xs text-white/60">{connected} of {state?.participants.length} helmets connected</Text> : null}
        </View>
        {lasted ? <Text className="font-mono text-sm text-white/70">{lasted}</Text> : null}
      </View>

      {status === 'requesting-media' || status === 'starting' || status === 'failed' ? (
        <View className="flex-1 items-center justify-center px-8">
          {status === 'failed' ? (
            <View className="max-w-sm items-center gap-4">
              <Text className="text-center text-sm leading-5 text-white/90">{state?.error}</Text>
              <Button title="Close" variant="secondary" onPress={close} />
            </View>
          ) : (
            <Text accessibilityLiveRegion="polite" className="text-center text-sm text-white/80">
              {status === 'requesting-media' ? `Allow the microphone${video ? ' and camera' : ''} when the tablet asks.` : 'Calling the helmets…'}
            </Text>
          )}
        </View>
      ) : over ? (
        <View className="flex-1" />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-4 pb-3">
          <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
            {tileWidth > 0 ? (
              <View className="flex-row flex-wrap" style={{ gap: GAP }}>
                {state?.participants.map((p) => (
                  <HelmetTile key={p.deviceId} participant={p} name={names.get(p.deviceId) ?? p.deviceId} width={tileWidth} onRetry={() => session?.retryHelmet(p.deviceId)} />
                ))}
                <View accessibilityLabel="Your camera" style={{ width: tileWidth, aspectRatio: 16 / 9 }} className="overflow-hidden rounded-xl bg-slate-800">
                  {hasVideo && state?.cameraOn ? <StreamView stream={state.localStream} muted mirrored overlay /> : null}
                  {!hasVideo || !state?.cameraOn ? (
                    <View className="absolute inset-0 items-center justify-center">
                      <Text className="text-xs text-slate-400">{state?.noCamera ? 'No camera: voice only' : hasVideo ? 'Camera off' : 'Voice only'}</Text>
                    </View>
                  ) : null}
                  <View className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5">
                    <Text className="text-[11px] text-white">You{state?.micOn ? '' : ' (muted)'}</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {over ? (
        <View className="mx-4 mb-3 items-center rounded-xl bg-black/50 p-4">
          <Text className="font-sans-semibold text-base text-white">{state?.endReason === 'left-app' ? 'The call ended when you left the app' : 'Call ended'}</Text>
          {lasted ? <Text className="mt-1 text-sm text-white/70">It lasted {lasted}.</Text> : null}
        </View>
      ) : null}

      {state?.outgoingFailed && !over ? (
        <Text accessibilityRole="alert" className="mx-4 mb-3 rounded-xl bg-amber-500/15 px-4 py-2.5 text-xs leading-5 text-amber-200">
          Your voice isn’t reaching the call, so the helmets can’t hear you. Hang up and call again.
        </Text>
      ) : null}

      {over ? (
        <View className="px-8"><Button title="Close" variant="secondary" onPress={close} /></View>
      ) : (
        <View className="flex-row items-end justify-center gap-8 px-6">
          <RoundButton icon={state?.micOn === false ? 'mic-off' : 'mic'} label={state?.micOn === false ? 'Muted' : 'Mute'} on={state?.micOn === false} disabled={!state?.localStream} onPress={() => session?.toggleMic()} />
          {hasVideo ? <RoundButton icon={state?.cameraOn ? 'video' : 'video-off'} label={state?.cameraOn ? 'Camera' : 'Camera off'} on={!state?.cameraOn} onPress={() => session?.toggleCamera()} /> : null}
          <RoundButton icon="phone-off" label="Hang up" danger size={76} onPress={() => end()} />
        </View>
      )}
    </View>
  )
}
