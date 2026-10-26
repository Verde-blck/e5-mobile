import { useState } from 'react'
import { Image, Pressable, View } from 'react-native'
import { Text } from '@/shared/components/Text'
import { useNow } from '@/shared/lib/useNow'
import { formatLastSeen } from '@/modules/devices/lib/presence'
import type { MediaItem } from '../types'
import { MediaViewer } from './MediaViewer'

const GAP = 10

export function PhotoGrid({ items, width, columns, emptyMessage, onLinkFailed }: { items: MediaItem[]; width: number; columns: number; emptyMessage: string; onLinkFailed: () => void }) {
  const now = useNow(30_000)
  const [open, setOpen] = useState<number | null>(null)
  if (items.length === 0) return <Text className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">{emptyMessage}</Text>
  const tile = width > 0 ? Math.floor((width - GAP * (columns - 1)) / columns) : 0

  return (
    <View>
      {tile > 0 ? (
        <View className="flex-row flex-wrap" style={{ gap: GAP }}>
          {items.map((item, index) => {
            const lag = item.uploadedAt != null ? item.uploadedAt - item.capturedAt : 0
            const ready = item.status === 'available'
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Photo from ${item.deviceName}, ${formatLastSeen(item.capturedAt, now)}`}
                accessibilityState={{ disabled: !ready }}
                disabled={!ready}
                onPress={() => setOpen(index)}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                style={{ width: tile }}
              >
                <View style={{ aspectRatio: 16 / 9 }} className="bg-slate-100">
                  {item.thumbnailUrl ? <Image source={{ uri: item.thumbnailUrl }} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> : null}
                  {!ready ? (
                    <View className="absolute inset-0 items-center justify-center bg-slate-900/70 px-2">
                      <Text className={item.status === 'uploading' ? 'text-center text-xs text-amber-200' : 'text-center text-xs text-red-200'}>{item.status === 'uploading' ? 'Uploading from helmet…' : 'Upload failed'}</Text>
                    </View>
                  ) : null}
                </View>
                <View className="px-2.5 py-2">
                  <Text className="font-sans-medium text-xs" numberOfLines={1}>{item.deviceName}</Text>
                  <Text className="text-[11px] text-slate-400">
                    {formatLastSeen(item.capturedAt, now)}
                    {/* A photo captured long before it arrived (the helmet was offline) is tagged as a late upload; without the tag the gallery looks like it is reordering itself. */}
                    {lag > 10 * 60_000 ? <Text className="text-[11px] text-amber-600"> · late upload</Text> : null}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : null}
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
