import { Pressable, View } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { cn } from '@/shared/lib/cn'
import { useLayout } from '@/shared/lib/layout'
import { Text } from './Text'

/**
 * The heading of a module that is a tab. On a narrow screen these modules live in More rather than in the bar,
 * so there it also offers the way back; on a tablet the rail is always there.
 */
export function PageTitle({ title, padded = true }: { title: string; padded?: boolean }) {
  const { size } = useLayout()
  return (
    <View className={cn('pb-3 pt-4', padded && 'px-4')}>
      {size === 'compact' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back to More" hitSlop={8} onPress={() => router.navigate('/more')} className="mb-1 flex-row items-center gap-1 self-start">
          <Feather name="chevron-left" size={18} color="#0A6659" />
          <Text className="font-sans-semibold text-sm text-brand-primary">More</Text>
        </Pressable>
      ) : null}
      <Text accessibilityRole="header" className="font-display-bold text-2xl">{title}</Text>
    </View>
  )
}
