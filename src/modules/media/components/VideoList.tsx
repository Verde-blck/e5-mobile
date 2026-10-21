import { useState } from 'react'
import { View } from 'react-native'
import { Button } from '@/shared/components/Button'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { useNow } from '@/shared/lib/useNow'
import { formatLastSeen } from '@/modules/devices/lib/presence'
import { formatBytes, formatDuration } from '../types'
import type { MediaItem } from '../types'
import { MediaViewer } from './MediaViewer'

const STATUS = {
  available: { label: 'Ready', box: 'bg-emerald-50', text: 'text-emerald-700' },
  uploading: { label: 'Uploading', box: 'bg-amber-50', text: 'text-amber-700' },
  failed: { label: 'Failed', box: 'bg-red-50', text: 'text-red-700' },
} as const

/** Recordings read better as a file list than a wall of near-identical stills: the useful facts are name, when, size and whether it is ready. */
export function VideoList({ items, onLinkFailed }: { items: MediaItem[]; onLinkFailed: () => void }) {
  const now = useNow(30_000)
  const [open, setOpen] = useState<number | null>(null)
  if (items.length === 0) return <Text className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">No recordings match those filters.</Text>
  // Live recordings come without a length; a row of dashes is noise.
  const hasLength = items.some((m) => m.durationMs != null)

  return (
    <View className="gap-2">
      {items.map((item, index) => {
        const s = STATUS[item.status]
        return (
          <View key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="min-w-0 flex-1 font-mono text-xs text-slate-800" numberOfLines={2}>{item.fileName ?? item.id}</Text>
              <View className={cn('rounded px-1.5 py-0.5', s.box)}><Text className={cn('text-[11px] font-sans-medium', s.text)}>{s.label}</Text></View>
            </View>
            <View className="mt-2 flex-row flex-wrap items-center gap-x-4 gap-y-1">
              <Text className="text-xs text-slate-600">{item.deviceName}</Text>
              <Text className="text-xs text-slate-500">{formatLastSeen(item.capturedAt, now)}</Text>
              {hasLength ? <Text className="text-xs text-slate-500">{formatDuration(item.durationMs) ?? '—'}</Text> : null}
              <Text className="text-xs text-slate-500">{formatBytes(item.sizeBytes) ?? '—'}</Text>
              {item.triggeredBy === 'alarm' ? <View className="rounded bg-red-600 px-1"><Text className="text-[10px] font-sans-semibold text-white">ALARM</Text></View> : null}
            </View>
            <Button title="Play" icon="play" variant="secondary" className="mt-3 h-10" disabled={item.status !== 'available'} accessibilityLabel={`Play ${item.fileName ?? item.id}`} onPress={() => setOpen(index)} />
          </View>
        )
      })}
      {open !== null && items[open] ? (
        <MediaViewer
          item={items[open]}
          now={now}
          onClose={() => setOpen(null)}
          onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
          onNext={open < items.length - 1 ? () => setOpen(open + 1) : undefined}
          onLinkFailed={onLinkFailed}
        />
      ) : null}
    </View>
  )
}
