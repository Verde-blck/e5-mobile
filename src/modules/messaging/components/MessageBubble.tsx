import { useState } from 'react'
import { View } from 'react-native'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import type { VoiceMessage } from '../types'
import { MessagePlayer } from './MessagePlayer'

/** One message: sent to the helmet on the right, from the wearer on the left. */
export function MessageBubble({ message, onMissing }: { message: VoiceMessage; onMissing: () => void }) {
  const outbound = message.direction === 'TO_HELMET'
  const [missing, setMissing] = useState(false)
  return (
    <View className={cn('mb-3 flex-row', outbound ? 'justify-end' : 'justify-start')}>
      <View style={{ maxWidth: '82%' }}>
        <Text className={cn('mb-1 text-[11px] text-slate-400', outbound ? 'text-right' : 'text-left')}>
          {outbound ? 'Sent to helmet' : 'From the wearer'} · {new Date(message.createdAt).toLocaleString()}
        </Text>
        <View className={cn('rounded-2xl px-3 py-2.5', outbound ? 'bg-brand-tint' : 'bg-slate-100')}>
          {!message.audioUrl || missing ? (
            <Text className="text-xs text-slate-500">Recording no longer available on the server</Text>
          ) : (
            <MessagePlayer
              url={message.audioUrl}
              fromHelmet={!outbound}
              onMissing={() => {
                setMissing(true)
                onMissing()
              }}
            />
          )}
        </View>
      </View>
    </View>
  )
}
