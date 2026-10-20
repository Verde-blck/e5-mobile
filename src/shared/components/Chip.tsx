import { Pressable } from 'react-native'
import { cn } from '@/shared/lib/cn'
import { Text } from './Text'

/** A pill for choosing one of a few options. */
export function Chip({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      hitSlop={6}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      onPress={onPress}
      className={cn('rounded-full border px-3.5 py-2', on ? 'border-brand-primary bg-brand-primary' : 'border-slate-300 bg-white', disabled && 'opacity-50')}
    >
      <Text className={cn('font-sans-medium text-sm', on ? 'text-white' : 'text-slate-700')}>{label}</Text>
    </Pressable>
  )
}
