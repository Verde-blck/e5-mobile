import { useEffect, useRef } from 'react'
import { Image, Modal, Pressable, View } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { formatLastSeen } from '@/modules/devices/lib/presence'
import { formatBytes, formatDuration } from '../types'
import type { MediaItem } from '../types'

function Player({ url, onError }: { url: string; onError: () => void }) {
  const player = useVideoPlayer(url)
  useEffect(() => {
    const subscription = player.addListener('statusChange', (event) => {
      if (event.status === 'error') onError()
    })
    return () => subscription.remove()
  }, [player, onError])
  // Clips run to ~117 MB, so nothing plays until the person presses play.
  return <VideoView player={player} nativeControls contentFit="contain" style={{ width: '100%', height: '100%' }} />
}

// The links are signed and expire, so a failing one reloads the list once.
export function MediaViewer({ item, now, onClose, onPrev, onNext, onLinkFailed }: { item: MediaItem; now: number; onClose: () => void; onPrev?: () => void; onNext?: () => void; onLinkFailed: () => void }) {
  // Once per item: if the fresh link fails too, the file itself is the problem, and asking again would just loop.
  const refreshedFor = useRef<string | null>(null)
  const linkFailed = () => {
    if (refreshedFor.current === item.id) return
    refreshedFor.current = item.id
    onLinkFailed()
  }
  const arrivedLate = item.uploadedAt != null && item.uploadedAt - item.capturedAt > 60 * 60_000
  const meta = [
    item.deviceName,
    `${item.kind === 'video' ? 'Recorded' : 'Captured'} ${formatLastSeen(item.capturedAt, now)}`,
    arrivedLate && item.uploadedAt != null ? `uploaded ${formatLastSeen(item.uploadedAt, now)}` : null,
    formatDuration(item.durationMs),
    formatBytes(item.sizeBytes),
  ].filter(Boolean)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait']}>
      <View className="flex-1 justify-center bg-black/80 p-3">
        <View className="overflow-hidden rounded-2xl bg-white">
          <View className="flex-row items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <View className="min-w-0 flex-1">
              <Text accessibilityRole="header" className="font-sans-semibold text-sm" numberOfLines={1}>{item.kind === 'video' ? 'Recording' : 'Photo'} · {item.deviceName}</Text>
              <Text className="text-xs text-slate-500" numberOfLines={2}>{meta.join(' · ')}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full active:bg-slate-100">
              <Feather name="x" size={22} color="#334155" />
            </Pressable>
          </View>

          <View className="bg-slate-900" style={{ aspectRatio: 4 / 3 }}>
            {!item.url ? (
              <View className="flex-1 items-center justify-center p-6"><Text className="text-center text-sm text-slate-300">This file has no link yet.</Text></View>
            ) : item.kind === 'photo' ? (
              <Image accessibilityLabel={`Photo from ${item.deviceName}`} source={{ uri: item.url }} resizeMode="contain" onError={linkFailed} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Player key={item.url + item.id} url={item.url} onError={linkFailed} />
            )}
          </View>

          <View className="flex-row items-center justify-between gap-2 px-3 py-2.5">
            <Button title="Previous" variant="ghost" icon="chevron-left" className="h-10" disabled={!onPrev} onPress={onPrev ?? (() => {})} />
            <Text className="min-w-0 flex-1 text-center text-xs text-slate-500" numberOfLines={1}>
              {item.triggeredBy === 'alarm' ? 'Captured by alarm trigger' : item.triggeredBy === 'remote-command' ? 'Captured by remote command' : item.kind === 'video' ? (item.fileName ?? '') : 'Captured manually'}
            </Text>
            <Button title="Next" variant="ghost" icon="chevron-right" className="h-10" disabled={!onNext} onPress={onNext ?? (() => {})} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
