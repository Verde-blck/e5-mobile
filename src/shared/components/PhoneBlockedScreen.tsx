import { View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { Text } from '@/shared/components/Text'
import { TABLET_MIN_DP } from '@/shared/lib/tabletGate'

/*
 * What a phone is shown instead of the app. It is drawn with fixed colours and nothing that needs the app's providers, because it is
 * shown before they exist. There is nothing to press: no sign-in, no way round it.
 */
function Message({ smallestDp }: { smallestDp: number }) {
  const insets = useSafeAreaInsets()
  return (
    <View
      testID="phone-blocked"
      style={{ flex: 1, backgroundColor: '#0C352F', paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 28, justifyContent: 'space-between' }}
    >
      <StatusBar style="light" />
      <View accessibilityRole="image" accessibilityLabel="E5 Energy" style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#A3E2D7', alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#0C352F" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4.5 16a7.5 7.5 0 0 1 15 0" />
          <Path d="M12 8.5V16" />
          <Path d="M2.5 16h19" />
          <Path d="M3.5 16v1.5h17V16" />
        </Svg>
      </View>

      <View>
        <Text accessibilityRole="header" className="font-display" style={{ fontSize: 34, lineHeight: 38, letterSpacing: -0.68, color: '#FFFFFF' }}>
          This app is for tablets
        </Text>
        <Text style={{ marginTop: 14, fontSize: 17, lineHeight: 26, color: '#A3E2D7' }}>
          E5 Command Centre is used on a tablet. Please open it there to sign in.
        </Text>
      </View>

      <Text style={{ fontSize: 13, lineHeight: 20, color: 'rgba(255, 255, 255, 0.6)' }}>
        This screen is {smallestDp} dp across at its narrowest; a tablet needs {TABLET_MIN_DP} or more. On a tablet and seeing this? Open Settings, then Display, and
        choose a smaller Display size or Screen zoom.
      </Text>
    </View>
  )
}

export function PhoneBlockedScreen({ smallestDp }: { smallestDp: number }) {
  return (
    <SafeAreaProvider>
      <Message smallestDp={smallestDp} />
    </SafeAreaProvider>
  )
}
