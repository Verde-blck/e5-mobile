import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { useStreamHasAudio } from '../hooks/useStreamHasAudio'
import type { StreamLike } from '../types'

// Says so when the picture is arriving without any sound, so a silent helmet isn't mistaken for a muted tablet.
export function NoSoundNotice({ stream, live, className }: { stream: StreamLike | null; live: boolean; className?: string }) {
  const hasAudio = useStreamHasAudio(stream)
  const [settled, setSettled] = useState(false)

  // Give the audio track a moment to arrive before saying there isn't one.
  useEffect(() => {
    setSettled(false)
    if (!live) return
    const id = setTimeout(() => setSettled(true), 3000)
    return () => clearTimeout(id)
  }, [live])

  if (!settled || hasAudio) return null
  return (
    <View testID="no-sound-notice" accessibilityRole="alert" className={cn('rounded-xl bg-amber-500/15 px-4 py-2', className)}>
      <Text className="text-xs leading-5 text-amber-200">No sound is coming from this helmet's stream. The picture is arriving, but without audio.</Text>
    </View>
  )
}
