import { ActivityIndicator, View } from 'react-native'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import type { SessionState, SessionStatus } from '../types'

/** Teal, not red: red in this app means an alarm. */
export function StatusPill({ status }: { status: SessionStatus }) {
  if (status === 'live') {
    return (
      <View className="flex-row items-center gap-1.5 rounded-full bg-brand-primary px-2.5 py-1">
        <View className="h-1.5 w-1.5 rounded-full bg-brand-mint" />
        <Text className="font-sans-semibold text-[11px] uppercase tracking-wide text-white">Live</Text>
      </View>
    )
  }
  const label = status === 'reconnecting' ? 'Reconnecting' : status === 'offline' ? 'Offline' : status === 'failed' ? 'Not connected' : status === 'ended' ? 'Ended' : 'Connecting'
  return (
    <View className={cn('rounded-full px-2.5 py-1', 'bg-white/10')}>
      <Text className="font-sans-medium text-[11px] text-white/70">{label}</Text>
    </View>
  )
}

function Waiting({ text }: { text: string }) {
  return (
    <View accessibilityLiveRegion="polite" className="max-w-xs items-center gap-3">
      <ActivityIndicator color="#A3E2D7" />
      <Text className="text-center text-sm leading-5 text-white/80">{text}</Text>
    </View>
  )
}

/** What to say, over the picture, while there isn't one: waiting, offline, or failed, each with the way forward. */
export function SessionMessage({ state, name, onRetry, onStartAgain }: { state: SessionState; name: string; onRetry: () => void; onStartAgain: () => void }) {
  switch (state.status) {
    case 'requesting-media':
      return <Waiting text="Allow the microphone when the tablet asks." />
    case 'starting':
      return <Waiting text={`Contacting ${name}…`} />
    case 'connecting':
      return <Waiting text="Starting the helmet camera. This usually takes 5 to 10 seconds." />
    case 'reconnecting':
      return <Waiting text="Signal dropped. Trying to get the picture back…" />
    case 'offline':
      return (
        <View className="max-w-sm items-center gap-3">
          <Text className="text-center font-sans-semibold text-base text-white">{name} is offline</Text>
          <Text className="text-center text-sm leading-5 text-white/70">It didn’t receive the request. Try again once it’s back online.</Text>
          <Button title="Try again" icon="refresh-cw" onPress={onStartAgain} />
        </View>
      )
    case 'failed':
      return (
        <View className="max-w-sm items-center gap-3">
          <Text className="text-center text-sm leading-5 text-white/90">{state.error}</Text>
          <Button title="Try again" icon="refresh-cw" onPress={onRetry} />
        </View>
      )
    default:
      return null
  }
}
