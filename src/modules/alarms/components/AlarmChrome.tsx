import { useMemo, type ReactNode } from 'react'
import { View } from 'react-native'
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCriticalAlarms } from '../hooks/useAlarms'
import { AlarmToast } from './AlarmToast'
import { SosBanner } from './SosBanner'

// The banner takes over the status-bar area, so while it shows the screens below must not add their own top padding.
export function AlarmChrome({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  const critical = useCriticalAlarms()

  const childInsets = useMemo(
    () => ({ ...insets, top: critical.length > 0 ? 0 : insets.top }),
    [insets, critical.length]
  )

  return (
    <View style={{ flex: 1 }}>
      <SosBanner alarms={critical} />
      <SafeAreaInsetsContext.Provider value={childInsets}>
        <View style={{ flex: 1 }}>
          {children}
          <AlarmToast />
        </View>
      </SafeAreaInsetsContext.Provider>
    </View>
  )
}
