import { View } from 'react-native'
import { cn } from '@/shared/lib/cn'
import { Text } from './Text'

/**
 * Text lockup standing in for the E5 logo artwork. Swap the mark for the real
 * logo asset when it's supplied — nothing else depends on this component's size.
 */
export function Logo({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const light = tone === 'light'
  return (
    <View className="flex-row items-center gap-3">
      <View
        className={cn(
          'h-11 w-11 items-center justify-center rounded-xl border',
          light ? 'border-white/25 bg-white/10' : 'border-brand-primary bg-brand-primary'
        )}
      >
        <Text className="font-display-extrabold text-xl text-white">E5</Text>
      </View>
      <View>
        <Text
          className={cn('font-display-bold text-lg', light ? 'text-white' : 'text-brand-secondary')}
        >
          E5 Energy
        </Text>
        <Text className={cn('text-xs', light ? 'text-white/70' : 'text-slate-500')}>
          Smart Helmet
        </Text>
      </View>
    </View>
  )
}
