import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/shared/components/Button'
import { AudioPreview } from '@/shared/components/AudioPreview'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { useRecorder, type RecordedAudio } from '@/shared/hooks/useRecorder'
import type { DeviceView } from '@/modules/devices/types'
import { useGroupBroadcast } from '../hooks/useGroupBroadcast'
import { describeOutcome, summarize } from '../lib/outcomes'
import { MAX_MESSAGE_SECONDS, sendLabel } from '../lib/roster'

const clock = (total: number) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

/** Record a message, listen to it, send it to every chosen helmet, and see what happened to each one. */
export function VoiceMessagePanel({ reachable }: { reachable: DeviceView[] }) {
  const [pending, setPending] = useState<RecordedAudio | null>(null)
  const { broadcast, sending, results, problem, clear } = useGroupBroadcast()
  const staged = useCallback((audio: RecordedAudio) => {
    clear()
    setPending(audio)
  }, [clear])
  const recorder = useRecorder({ maxSeconds: MAX_MESSAGE_SECONDS, namePrefix: 'message', onFinished: staged })

  async function send() {
    if (!pending || reachable.length === 0) return
    const ok = await broadcast(reachable.map((d) => ({ id: d.id, name: d.name })), pending)
    // Kept for another go only when nothing was sent at all.
    if (ok) setPending(null)
  }

  return (
    <View className="rounded-xl border border-slate-200 bg-white p-4">
      <Text className="mb-3 text-sm leading-5 text-slate-700">Record a message and every selected helmet plays it aloud.</Text>

      {recorder.active ? (
        <View className="gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <View className="flex-row items-center gap-2">
            <View className="h-3 w-3 rounded-full bg-red-600" />
            <Text className="flex-1 font-sans-semibold text-sm text-red-800">Recording…</Text>
            <Text className="font-mono text-sm text-red-800">{clock(recorder.seconds)} / {clock(MAX_MESSAGE_SECONDS)}</Text>
          </View>
          <View className="flex-row gap-2">
            <Button title="Stop" icon="square" className="h-11 flex-1" onPress={() => void recorder.stop()} />
            <Button title="Cancel recording" variant="secondary" className="h-11 flex-1" onPress={() => void recorder.cancel()} />
          </View>
        </View>
      ) : (
        <Button title={pending ? 'Record again' : 'Record message'} icon="mic" variant="secondary" disabled={sending} onPress={() => { setPending(null); clear(); void recorder.start() }} />
      )}
      {recorder.error ? <Text accessibilityRole="alert" className="mt-2 text-sm text-red-600">{recorder.error}</Text> : null}

      {pending ? (
        <View className="mt-4 gap-3 rounded-xl border border-slate-200 p-3">
          <Text className="text-xs text-slate-500">
            Listen before sending to {reachable.length} {reachable.length === 1 ? 'helmet' : 'helmets'}:
          </Text>
          <AudioPreview uri={pending.uri} />
          <Button title={sendLabel(reachable.length, sending)} icon="send" loading={sending} disabled={reachable.length === 0} onPress={() => void send()} />
          {reachable.length === 0 ? <Text className="text-xs text-amber-700">Select at least one active helmet.</Text> : null}
          <Button title="Discard" variant="ghost" disabled={sending} onPress={() => setPending(null)} />
        </View>
      ) : null}

      {problem ? <Text accessibilityRole="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{problem}</Text> : null}

      {results ? (
        <View className="mt-4">
          <Text className="mb-1 font-sans-semibold text-sm">{summarize(results)}</Text>
          {results.map((r) => (
            <Text
              key={r.deviceId}
              className={cn('text-sm leading-6', r.status === 'sent' ? 'text-emerald-700' : r.status === 'queued' ? 'text-slate-600' : 'text-red-600')}
            >
              {r.deviceName}: {describeOutcome(r.status)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}
