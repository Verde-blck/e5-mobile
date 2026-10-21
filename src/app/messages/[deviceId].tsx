import { useCallback, useRef, useState } from 'react'
import { ScrollView, View, type ScrollViewInstance } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { AudioPreview } from '@/shared/components/AudioPreview'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { RequirePermission } from '@/shared/components/RequirePermission'
import { Screen } from '@/shared/components/Screen'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/States'
import { Text } from '@/shared/components/Text'
import { useRecorder, type RecordedAudio } from '@/shared/hooks/useRecorder'
import { useCan } from '@/shared/lib/permissions'
import { describeUploadError, type UploadProblem } from '@/shared/lib/uploadError'
import { useDeviceViews } from '@/modules/devices/hooks/useDevices'
import { broadcastAvailable } from '@/modules/group-call/api/broadcast.api'
import { MAX_MESSAGE_SECONDS } from '@/modules/messaging/lib/limits'
import { MessageBubble } from '@/modules/messaging/components/MessageBubble'
import { useMessages, useSendVoiceMessage } from '@/modules/messaging/hooks/useMessages'

const clock = (total: number) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

function MessagesScreen({ deviceId }: { deviceId: string }) {
  const { devices } = useDeviceViews()
  const name = devices.find((d) => d.id === deviceId)?.name ?? 'the helmet'
  const { messages, isLoading, isError, refetch, forbidden } = useMessages(deviceId)
  const send = useSendVoiceMessage(deviceId)
  const canSend = useCan('groupCall:write')
  const scroller = useRef<ScrollViewInstance>(null)
  const [pending, setPending] = useState<RecordedAudio | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [problem, setProblem] = useState<UploadProblem | null>(null)
  const [missing, setMissing] = useState(0)
  const staged = useCallback((audio: RecordedAudio) => {
    setNote(null)
    setProblem(null)
    setPending(audio)
  }, [])
  const recorder = useRecorder({ maxSeconds: MAX_MESSAGE_SECONDS, namePrefix: 'message', onFinished: staged })

  function submit() {
    if (!pending) return
    setProblem(null)
    send.mutate(pending, {
      onSuccess: (result) => {
        setPending(null)
        setNote(result.delivered ? 'Delivered to the helmet.' : 'Queued. The helmet will play it when it next connects.')
      },
      onError: (error) => setProblem(describeUploadError(error, 'that recording')),
    })
  }

  return (
    <Screen top={false}>
      <Stack.Screen options={{ title: name }} />
      <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-12 pt-4" onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}>
        <Container max={640}>
          {isLoading ? <LoadingState label="Loading the conversation…" /> : null}
          {forbidden ? <Text className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your role can't see this helmet's messages.</Text> : isError ? <ErrorState title="Couldn't load the conversation" onRetry={() => void refetch()} /> : null}
          {!isLoading && !isError && messages.length === 0 ? <EmptyState icon="message-circle" title="No messages yet" hint="Record one below and the helmet will play it aloud." /> : null}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onMissing={() => setMissing((n) => n + 1)} />
          ))}
          {missing > 0 ? (
            <Text className="mb-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              {missing} {missing === 1 ? 'recording' : 'recordings'} couldn't be loaded. Links expire after an hour; this list refreshes on its own, or leave and reopen it.
            </Text>
          ) : null}

          {canSend ? (
            <View className="mt-2 rounded-xl border border-slate-200 bg-white p-4">
              <Text className="mb-3 text-sm leading-5 text-slate-700">Record a message and the helmet plays it aloud to the wearer.</Text>
              {!broadcastAvailable() ? (
                <Text className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">Sending voice messages isn't switched on in this build yet.</Text>
              ) : recorder.active ? (
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
                <Button title={pending ? 'Record again' : 'Record voice'} icon="mic" variant="secondary" disabled={send.isPending} onPress={() => { setPending(null); setNote(null); void recorder.start() }} />
              )}
              {recorder.error ? <Text accessibilityRole="alert" className="mt-2 text-sm text-red-600">{recorder.error}</Text> : null}

              {pending ? (
                <View className="mt-4 gap-3 rounded-xl border border-slate-200 p-3">
                  <Text className="text-xs text-slate-500">Ready to send. Listen first:</Text>
                  <AudioPreview uri={pending.uri} />
                  <Button title="Send to helmet" icon="send" loading={send.isPending} onPress={submit} />
                  <Button title="Discard" variant="ghost" disabled={send.isPending} onPress={() => setPending(null)} />
                </View>
              ) : null}
              {problem ? (
                <View accessibilityRole="alert" className="mt-3 rounded-xl bg-red-50 p-3">
                  <Text className="text-sm text-red-700">{problem.message}</Text>
                  {problem.detail ? <Text className="mt-1 font-mono text-[11px] text-red-500">{problem.detail}</Text> : null}
                </View>
              ) : null}
              {note ? <Text className="mt-3 text-sm text-slate-600">{note}</Text> : null}
            </View>
          ) : null}
        </Container>
      </ScrollView>
    </Screen>
  )
}

export default function MessagesRoute() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>()
  return (
    <RequirePermission permission="groupCall:read" fallback="/more">
      <MessagesScreen deviceId={decodeURIComponent(String(deviceId ?? ''))} />
    </RequirePermission>
  )
}
