import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { cn } from '@/shared/lib/cn'

interface ScreenProps {
  children: ReactNode
  /** Pad for the status bar / notch. Off for screens that draw their own header. */
  top?: boolean
  className?: string
}

/**
 * The page backdrop. Insets are applied as plain padding rather than through
 * a styled third-party SafeAreaView, which keeps className behaviour identical
 * on iOS, Android and web.
 */
export function Screen({ children, top = true, className }: ScreenProps) {
  const insets = useSafeAreaInsets()
  return (
    <View
      className={cn('flex-1 bg-slate-50', className)}
      style={{ paddingTop: top ? insets.top : 0 }}
    >
      {children}
    </View>
  )
}
