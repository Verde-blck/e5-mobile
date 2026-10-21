import { Pressable, View } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { Text } from '@/shared/components/Text'
import { cn } from '@/shared/lib/cn'

/** A round control on a dark call screen: mute, camera, hang up. */
export function RoundButton({ icon, label, on, onPress, danger, size = 64, disabled }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; on?: boolean; onPress: () => void; danger?: boolean; size?: number; disabled?: boolean }) {
  return (
    <View className="items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!on, disabled }}
        aria-pressed={on}
        disabled={disabled}
        onPress={onPress}
        style={{ width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.4 : 1 }}
        className={cn('items-center justify-center', danger ? 'bg-red-600 active:bg-red-700' : on ? 'bg-white active:bg-slate-200' : 'bg-white/15 active:bg-white/25')}
      >
        <Feather name={icon} size={size / 2.6} color={danger ? '#FFFFFF' : on ? '#0C352F' : '#FFFFFF'} />
      </Pressable>
      <Text className="text-xs text-white/80">{label}</Text>
    </View>
  )
}
