import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'

// One message plays at a time: starting another stops the one that was going.
let current: { stop: () => void } | null = null

/**
 * Plays one voice message. The link is signed and expires after about an hour, so before playing it is asked
 * for one byte: a dead link is caught immediately and reported (the web does the same), rather than the player
 * sitting there silently. Helmets record AMR, which Android's own player reads, so there is no decoder here.
 */
export function MessagePlayer({ url, fromHelmet, onMissing }: { url: string; fromHelmet: boolean; onMissing: () => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const player = useRef<AudioPlayer | null>(null)
  const self = useRef({ stop: () => {} })

  self.current.stop = () => {
    player.current?.pause()
    setState('idle')
  }

  async function toggle() {
    if (state === 'playing') return self.current.stop()
    setState('loading')
    try {
      if (/^https?:/i.test(url)) {
        const res = await fetch(url, { headers: { Range: 'bytes=0-0' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      }
      player.current?.remove()
      const next = createAudioPlayer({ uri: url })
      next.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) setState('idle')
      })
      player.current = next
      current?.stop()
      current = self.current
      next.play()
      setState('playing')
    } catch {
      setState('idle')
      onMissing()
    }
  }

  useEffect(
    () => () => {
      if (current === self.current) current = null
      player.current?.remove()
      player.current = null
    },
    []
  )

  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state === 'playing' ? 'Pause' : 'Play'}
        disabled={state === 'loading'}
        onPress={() => void toggle()}
        className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm active:bg-slate-100"
        style={{ opacity: state === 'loading' ? 0.5 : 1 }}
      >
        <Feather name={state === 'playing' ? 'pause' : 'play'} size={16} color="#0C352F" />
      </Pressable>
      <Text className="text-xs text-slate-600">{state === 'loading' ? 'Loading…' : fromHelmet ? 'Voice clip from the helmet' : 'Voice message'}</Text>
    </View>
  )
}
