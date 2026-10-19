import { useState } from 'react'
import { Image, Modal, Pressable, ScrollView, View } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'
import type { AlarmPhoto, AlarmVideo } from '../footage'

function formatSize(bytes: number | undefined): string {
  if (!bytes) return ''
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`
}

export function PhotoStrip({ photos }: { photos: AlarmPhoto[] }) {
  const [open, setOpen] = useState<AlarmPhoto | null>(null)

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
        {photos.map((photo) => (
          <Pressable
            key={photo.id}
            accessibilityRole="imagebutton"
            accessibilityLabel="Alarm photo, tap to enlarge"
            onPress={() => setOpen(photo)}
          >
            <Image
              source={{ uri: photo.url }}
              resizeMode="cover"
              className="h-28 w-40 rounded-xl bg-slate-200"
            />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={open !== null} animationType="fade" onRequestClose={() => setOpen(null)}>
        <View className="flex-1 bg-black">
          {open ? (
            <Image source={{ uri: open.url }} resizeMode="contain" className="flex-1" />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            onPress={() => setOpen(null)}
            className="absolute right-4 top-12 h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </>
  )
}

function ClipPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.play()
  })
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}
    />
  )
}

export function VideoList({ videos }: { videos: AlarmVideo[] }) {
  const [open, setOpen] = useState<AlarmVideo | null>(null)

  return (
    <>
      {videos.map((video, index) => (
        <Pressable
          key={video.id}
          accessibilityRole="button"
          accessibilityLabel={`Play clip ${index + 1}`}
          onPress={() => setOpen(video)}
          className="mb-2 flex-row items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 active:bg-slate-100"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-primary">
            <Feather name="play" size={16} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="font-sans-medium text-sm">Clip {index + 1}</Text>
            <Text className="text-xs text-slate-500">
              {[video.recordedClock ? `Helmet clock ${video.recordedClock}` : null, formatSize(video.sizeBytes)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </Pressable>
      ))}

      <Modal visible={open !== null} animationType="slide" onRequestClose={() => setOpen(null)}>
        <View className="flex-1 justify-center bg-black">
          {open ? <ClipPlayer url={open.url} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close clip"
            onPress={() => setOpen(null)}
            className="absolute right-4 top-12 h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </>
  )
}
