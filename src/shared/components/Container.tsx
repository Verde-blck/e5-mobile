import type { ReactNode } from 'react'
import { View } from 'react-native'
import { CONTENT_MAX_DP } from '@/shared/lib/layout'

/** Centres content and caps its width, so single-column screens stay readable on a tablet. */
export function Container({
  children,
  max = CONTENT_MAX_DP,
  className,
}: {
  children: ReactNode
  max?: number
  className?: string
}) {
  return (
    <View className={className} style={{ width: '100%', maxWidth: max, alignSelf: 'center' }}>
      {children}
    </View>
  )
}
