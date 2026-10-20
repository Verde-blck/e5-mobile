import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { Button } from '@/shared/components/Button'

/** Plays the chosen clip so the person can check it's the right one before saving. */
export function ClipPreview({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri)
  const status = useAudioPlayerStatus(player)

  async function toggle() {
    try {
      if (status.playing) {
        player.pause()
      } else {
        await player.seekTo(0)
        player.play()
      }
    } catch {
      /* a clip that won't play in the preview isn't a reason to block saving it */
    }
  }

  return (
    <Button
      title={status.playing ? 'Stop' : 'Play preview'}
      variant="secondary"
      icon={status.playing ? 'square' : 'play'}
      className="h-10"
      onPress={() => void toggle()}
    />
  )
}
