import { View } from 'react-native'
import { cn } from '@/shared/lib/cn'
import { BackButton } from './BackButton'
import { Text } from './Text'

export function PageTitle({ title, padded = true }: { title: string; padded?: boolean }) {
  return (
    <View className={cn('flex-row items-center gap-1 pb-2 pt-3', padded && 'px-2')}>
      <BackButton />
      <Text accessibilityRole="header" className="min-w-0 flex-1 font-display-bold text-2xl" numberOfLines={1}>{title}</Text>
    </View>
  )
}
