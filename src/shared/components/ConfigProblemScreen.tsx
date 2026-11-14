import { View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/shared/components/Text'

// Shown instead of the app when this build was made without a usable server address. Like the phone screen it is drawn with fixed
// colours and nothing that needs the app's providers, because it is shown before they exist.
function Message({ problem }: { problem: string }) {
  const insets = useSafeAreaInsets()
  return (
    <View testID="config-problem" style={{ flex: 1, backgroundColor: '#0C352F', paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 28, justifyContent: 'center' }}>
      <StatusBar style="light" />
      <Text accessibilityRole="header" className="font-display" style={{ fontSize: 34, lineHeight: 38, letterSpacing: -0.68, color: '#FFFFFF' }}>
        This build is not set up
      </Text>
      <Text testID="config-problem-text" style={{ marginTop: 14, fontSize: 17, lineHeight: 26, color: '#A3E2D7' }}>
        {problem}
      </Text>
      <Text style={{ marginTop: 28, fontSize: 13, lineHeight: 20, color: 'rgba(255, 255, 255, 0.6)' }}>
        Nothing is wrong with your account. Tell whoever built this app that it needs a valid server address, then install the corrected version.
      </Text>
    </View>
  )
}

export function ConfigProblemScreen({ problem }: { problem: string }) {
  return (
    <SafeAreaProvider>
      <Message problem={problem} />
    </SafeAreaProvider>
  )
}
