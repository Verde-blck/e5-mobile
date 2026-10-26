import { Pressable } from 'react-native'
import { router } from 'expo-router'
import Feather from '@expo/vector-icons/Feather'
import { useBrandColours } from '@/modules/branding/hooks/useBranding'
import { cn } from '@/shared/lib/cn'

export function BackButton({ floating = false, className }: { floating?: boolean; className?: string }) {
  const brand = useBrandColours()
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
      <Feather name="arrow-left" size={22} color={brand.secondary} />
    </Pressable>
  )
}
