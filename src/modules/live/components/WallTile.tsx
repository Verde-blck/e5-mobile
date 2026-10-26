import { Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { useSessionState } from '../hooks/useSessionState'
import type { HelmetSession } from '../lib/session'
import { SessionMessage, StatusPill } from './SessionPanel'
import { StreamView } from './StreamView'

export function WallTile({ name, session, width, onStart, onRemove, onFocus }: { name: string; session: HelmetSession | null; width: number; onStart: () => void; onRemove: () => void; onFocus: () => void }) {
  const state = useSessionState(session)
  const live = state?.status === 'live'
  const stopped = !state || state.status === 'ended'

  return (
    <View style={{ width, aspectRatio: 16 / 9 }} className="overflow-hidden rounded-xl bg-slate-900">
      <StreamView stream={state?.remoteStream ?? null} muted />
      {!live ? (
        <View className="absolute inset-0 items-center justify-center p-3 pt-9">
          {stopped ? (
            <View className="items-center gap-2">
              <Text className="text-sm text-white/60">Stopped</Text>
              <Button title="Start" icon="play" className="h-9" onPress={onStart} />
            </View>
          ) : (
            <SessionMessage compact state={state} name={name} onRetry={() => session?.retry()} onStartAgain={onStart} />
          )}
        </View>
      ) : null}

      <View className="absolute inset-x-0 top-0 flex-row items-center justify-between gap-2 bg-black/55 px-2.5 py-1.5">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {state && !stopped ? <StatusPill status={state.status} /> : null}
          <Text className="min-w-0 flex-1 font-sans-medium text-xs text-white" numberOfLines={1}>{name}</Text>
        </View>
        <View className="flex-row gap-1">
          <Pressable accessibilityRole="button" accessibilityLabel={`Enlarge ${name}`} disabled={!live} onPress={onFocus} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-md bg-white/15 active:bg-white/30" style={{ opacity: live ? 1 : 0.35 }}>
            <Feather name="maximize-2" size={15} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name} from the wall`} onPress={onRemove} hitSlop={6} className="h-8 w-8 items-center justify-center rounded-md bg-white/15 active:bg-white/30">
            <Feather name="x" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  )
}
