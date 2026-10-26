import { ActivityIndicator, View } from 'react-native'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import type { SessionState, SessionStatus } from '../types'

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

function Waiting({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <View accessibilityLiveRegion="polite" className="max-w-xs items-center gap-2">
      <ActivityIndicator color="#A3E2D7" size={compact ? 'small' : 'large'} />
      <Text className={cn('text-center text-white/80', compact ? 'text-xs leading-4' : 'text-sm leading-5')}>{text}</Text>
    </View>
  )
}

export function SessionMessage({ state, name, onRetry, onStartAgain, compact }: { state: SessionState; name: string; onRetry: () => void; onStartAgain: () => void; compact?: boolean }) {
  switch (state.status) {
    case 'requesting-media':
      return <Waiting compact={compact} text="Allow the microphone when the tablet asks." />
    case 'starting':
      return <Waiting compact={compact} text={`Contacting ${name}…`} />
    case 'connecting':
      return <Waiting compact={compact} text={compact ? 'Starting the camera…' : 'Starting the helmet camera. This usually takes 5 to 10 seconds.'} />
    case 'reconnecting':
      return <Waiting compact={compact} text={compact ? 'Signal dropped. Reconnecting…' : 'Signal dropped. Trying to get the picture back…'} />
    case 'offline':
      return (
        <View className="max-w-sm items-center gap-2">
          <Text className={cn('text-center font-sans-semibold text-white', compact ? 'text-sm' : 'text-base')}>{name} is offline</Text>
          {compact ? null : <Text className="text-center text-sm leading-5 text-white/70">It didn’t receive the request. Try again once it’s back online.</Text>}
          <Button title="Try again" icon="refresh-cw" className={compact ? 'h-9' : undefined} onPress={onStartAgain} />
        </View>
      )
    case 'failed':
      return (
        <View className="max-w-sm items-center gap-2">
          <Text numberOfLines={compact ? 3 : undefined} className={cn('text-center text-white/90', compact ? 'text-xs leading-4' : 'text-sm leading-5')}>{state.error}</Text>
          <Button title="Try again" icon="refresh-cw" className={compact ? 'h-9' : undefined} onPress={onRetry} />
        </View>
      )
    default:
      return null
  }
}
