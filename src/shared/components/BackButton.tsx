import { Pressable } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { cn } from '@/shared/lib/cn'

/**
 * The back arrow on every module page: it takes you to the initial page (the Dashboard, or the first page the account
 * may use). `floating` is the round button that sits over the map.
 */
export function BackButton({ floating = false, className }: { floating?: boolean; className?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to Dashboard"
      hitSlop={8}
      onPress={() => router.navigate('/')}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-full active:bg-slate-200/70',
        floating && 'absolute left-3 top-3 border border-slate-200 bg-white shadow-md',
        className
      )}
    >
      <Feather name="arrow-left" size={22} color="#0C352F" />
    </Pressable>
  )
}
