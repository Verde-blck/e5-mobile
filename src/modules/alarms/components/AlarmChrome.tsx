import { useMemo, type ReactNode } from 'react'
import { View } from 'react-native'
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCriticalAlarms } from '../hooks/useAlarms'
import { AlarmToast } from './AlarmToast'
import { SosBanner } from './SosBanner'

/**
 * Wraps the whole app so the SOS banner can sit above every screen.
 *
 * The banner takes over the status-bar area, so while it's showing, the
 * screens below must not add their own top padding for it too. That's done by
 * telling everything underneath that the top inset is zero — screens and
 * headers already read their insets from this context, so none of them needs
 * to know the banner exists.
 */
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
