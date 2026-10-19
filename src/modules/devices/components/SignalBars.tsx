import { View } from 'react-native'
import { cn } from '@/shared/lib/cn'
import { Text } from '@/shared/components/Text'

const BARS = 5

/** The API's lastNetStrength: 0–5 bars. */
export function SignalBars({ level }: { level: number | undefined }) {
  if (level === undefined) return <Text className="font-sans-medium text-sm">—</Text>
  const filled = Math.max(0, Math.min(BARS, Math.round(level)))

  return (
    <View
      accessibilityLabel={`Signal ${filled} of ${BARS}`}
      className="flex-row items-end gap-0.5"
    >
      {Array.from({ length: BARS }, (_, i) => (
        <View
          key={i}
          style={{ height: 6 + i * 3 }}
          className={cn('w-1.5 rounded-sm', i < filled ? 'bg-brand-primary' : 'bg-slate-200')}
        />
      ))}
    </View>
  )
}
