import { ActivityIndicator, Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { cn } from '@/shared/lib/cn'
import type { IconName } from '@/shared/constants/modules'
import { Text } from './Text'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  icon?: IconName
  className?: string
  /** What a screen reader says, when the visible title alone is ambiguous (a list of identical "Play" buttons). */
  accessibilityLabel?: string
}

const BOX: Record<Variant, string> = {
  primary: 'bg-brand-primary active:bg-brand-secondary',
  secondary: 'bg-white border border-slate-300 active:bg-slate-100',
  danger: 'bg-red-600 active:bg-red-700',
  ghost: 'active:bg-slate-100',
}

const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-slate-800',
  danger: 'text-white',
  ghost: 'text-brand-primary',
}

const ICON_COLOR: Record<Variant, string> = {
  primary: '#FFFFFF',
  secondary: '#1E293B',
  danger: '#FFFFFF',
  ghost: '#0A6659',
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  className,
  accessibilityLabel,
}: ButtonProps) {
  const inactive = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      className={cn(
        'h-12 flex-row items-center justify-center gap-2 rounded-xl px-5',
        BOX[variant],
        inactive && 'opacity-50',
        className
      )}
    >
      {loading ? (
        <ActivityIndicator color={ICON_COLOR[variant]} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? <Feather name={icon} size={18} color={ICON_COLOR[variant]} /> : null}
          <Text className={cn('font-sans-semibold text-base', LABEL[variant])}>{title}</Text>
        </View>
      )}
    </Pressable>
  )
}
