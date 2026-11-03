import type { ReactNode } from 'react'
import { View } from 'react-native'
import { CriticalAlarmModal } from './CriticalAlarmModal'
import { WarningBanner } from './WarningBanner'

export function AlarmChrome({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      {children}
      <WarningBanner />
      <CriticalAlarmModal />
    </View>
  )
}
