import { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { useSessionState } from '../hooks/useSessionState'
import type { HelmetSession } from '../lib/session'
import { NoSoundNotice } from './NoSoundNotice'
import { StatusPill } from './SessionPanel'
import { StreamView } from './StreamView'

export function FocusView({ name, session, onClose }: { name: string; session: HelmetSession | null; onClose: () => void }) {
  const state = useSessionState(session)
  const [muted, setMuted] = useState(false)
  const stream = state?.remoteStream ?? null
  const onBlocked = useCallback(() => setMuted(true), [])

  // The tile underneath is always silent; leaving this view must hand it back that way.
  useEffect(
    () => () => {
      stream?.getAudioTracks().forEach((track) => {
        track.enabled = false
      })
    },
    [stream]
  )

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait']}>
      <View className="flex-1 justify-center bg-black/90 p-4">
        <View className="overflow-hidden rounded-2xl bg-slate-900">
          <View className="flex-row items-center justify-between gap-3 px-4 py-3">
            <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
              {state ? <StatusPill status={state.status} /> : null}
              <Text className="min-w-0 flex-1 font-sans-semibold text-base text-white" numberOfLines={1}>{name}</Text>
            </View>
            <Button title="Back to wall" variant="secondary" className="h-10" onPress={onClose} />
          </View>
          <View style={{ aspectRatio: 16 / 9 }} className="bg-black">
            <StreamView stream={stream} muted={muted} onAutoplayBlocked={onBlocked} />
          </View>
          <NoSoundNotice className="mx-4 mt-3" stream={stream} live={state?.status === 'live'} />
          <View className="flex-row px-4 py-3">
            <Pressable accessibilityRole="button" accessibilityState={{ selected: !muted }} aria-pressed={!muted} onPress={() => setMuted((m) => !m)} className="min-h-11 flex-row items-center gap-2 rounded-xl bg-white/10 px-4 active:bg-white/20">
              <Feather name={muted ? 'volume-x' : 'volume-2'} size={18} color="#FFFFFF" />
              <Text className="text-sm text-white">{muted ? 'Turn sound on' : 'Mute'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
