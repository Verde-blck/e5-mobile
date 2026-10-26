import { Pressable, View } from 'react-native'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'
import { describePeriod, isTooSmall } from '../lib/geometry'
import { BEHAVIOR_LABEL, type Fence } from '../types'

export function fenceSwatch(fence: Pick<Fence, 'behavior' | 'active'>): string {
  return !fence.active ? 'bg-slate-300' : fence.behavior === 'NO_ENTRY' ? 'bg-amber-500' : 'bg-brand-primary'
}

export function FenceCard({
  fence,
  selected,
  onPress,
  children,
}: {
  fence: Fence
  selected?: boolean
  onPress?: () => void
  children?: React.ReactNode
}) {
  return (
    <View
      className={cn(
        'mb-3 rounded-2xl border p-4',
        selected ? 'border-brand-primary bg-brand-tint' : 'border-slate-200 bg-white'
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: !!selected }}
        accessibilityLabel={`${fence.name}, ${BEHAVIOR_LABEL[fence.behavior].short}${fence.active ? '' : ', off'}`}
        onPress={onPress}
        disabled={!onPress}
      >
        <View className="flex-row items-center gap-2">
          <View className={cn('h-3 w-3 rounded-sm', fenceSwatch(fence))} />
          <Text className="flex-1 font-sans-semibold text-base" numberOfLines={1}>
            {fence.name}
          </Text>
          {!fence.active ? (
            <View className="rounded bg-slate-100 px-1.5 py-0.5">
              <Text className="text-[10px] text-slate-500">Off</Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1.5 text-sm text-slate-600">
          {BEHAVIOR_LABEL[fence.behavior].short} ·{' '}
          {fence.type === 'ROUND' ? `circle, ${Math.round(fence.radiusMeters)} m radius` : `${fence.points.length}-corner polygon`}
        </Text>
        <Text className="mt-0.5 text-sm text-slate-500">
          {fence.validPeriods.length ? fence.validPeriods.map(describePeriod).join(', ') : 'Always on'} ·{' '}
          {fence.deviceIds.length ? `${fence.deviceIds.length} ${fence.deviceIds.length === 1 ? 'helmet' : 'helmets'}` : 'every helmet'}
          {fence.hasWarningAudio ? ' · warning clip' : ''}
        </Text>
        {isTooSmall(fence) ? <Text className="mt-1 text-sm text-amber-700">Small fence: may false-alarm</Text> : null}
      </Pressable>
      {children}
    </View>
  )
}
