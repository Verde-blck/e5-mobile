import { View } from 'react-native'
import { cn } from '@/shared/lib/cn'
import { Text } from '@/shared/components/Text'
import type { Presence } from '../types'

const TONES: Record<Presence, { dot: string; text: string; bg: string; label: string }> = {
  online: { dot: 'bg-emerald-500', text: 'text-emerald-800', bg: 'bg-emerald-50', label: 'Online' },
  degraded: { dot: 'bg-amber-500', text: 'text-amber-800', bg: 'bg-amber-50', label: 'Degraded' },
  offline: { dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100', label: 'Offline' },
}

export function PresenceBadge({ presence }: { presence: Presence }) {
  const tone = TONES[presence]
  return (
    <View
      accessibilityLabel={`Status: ${tone.label}`}
      className={cn('flex-row items-center gap-1.5 rounded-full px-2.5 py-1', tone.bg)}
    >
      <View className={cn('h-2 w-2 rounded-full', tone.dot)} />
      <Text className={cn('font-sans-medium text-xs', tone.text)}>{tone.label}</Text>
    </View>
  )
}
