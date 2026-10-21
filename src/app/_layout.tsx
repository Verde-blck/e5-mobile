import '../../global.css'

import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider, focusManager } from '@tanstack/react-query'

// One import per weight, deliberately not the package root: the root re-exports
// every weight of the family, and Metro would bundle all of those font files.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { Epilogue_600SemiBold } from '@expo-google-fonts/epilogue/600SemiBold'
import { Epilogue_700Bold } from '@expo-google-fonts/epilogue/700Bold'
import { Epilogue_800ExtraBold } from '@expo-google-fonts/epilogue/800ExtraBold'
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular'
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium'

import { restoreSession } from '@/modules/auth/api/auth.api'
import { AlarmChrome } from '@/modules/alarms/components/AlarmChrome'
import { LiveAlarms } from '@/modules/alarms/components/LiveAlarms'
import { PushRuntime } from '@/modules/push/components/PushRuntime'
import { queryClient } from '@/shared/lib/query-client'
import { endSession } from '@/shared/lib/session'
import { onUnauthorized } from '@/shared/lib/unauthorized'
import { useAuthStore } from '@/shared/store/authStore'

// Hold the native splash screen until fonts and the saved session are ready,
// so there's no flash of a signed-out screen for someone who is signed in.
void SplashScreen.preventAutoHideAsync()

// React Query decides when to refetch based on "focus". In a browser that's
// the tab; on a phone it's the app being in the foreground. Wiring it to
// AppState means polling stops when the phone is locked or the app is
// backgrounded, and refreshes the moment it comes back.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => {
      handleFocus(state === 'active')
    })
    return () => subscription.remove()
  })
}

const FONT_ASSETS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Epilogue_600SemiBold,
  Epilogue_700Bold,
  Epilogue_800ExtraBold,
  GeistMono_400Regular,
  GeistMono_500Medium,
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS)
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Restore the saved session once, on launch.
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const user = await restoreSession()
        if (alive) useAuthStore.getState().setUser(user)
      } finally {
        if (alive) useAuthStore.getState().setBootstrapping(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // A 401/403 from anywhere in the app means the token is dead.
  useEffect(() => onUnauthorized(() => void endSession()), [])

  const ready = (fontsLoaded || !!fontError) && !isBootstrapping

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        {/* Alarm alerts run for as long as someone is signed in. */}
        {isAuthenticated ? <LiveAlarms /> : null}
        {/* ...and so do alerts for a locked tablet, when this build has them. */}
        {isAuthenticated ? <PushRuntime /> : null}
        <AlarmChrome>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={isAuthenticated}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="helmet/[id]"
              options={{ headerShown: true, title: 'Helmet', ...HEADER }}
            />
            <Stack.Screen
              name="alarm/[id]"
              options={{ headerShown: true, title: 'Alarm', ...HEADER }}
            />
            <Stack.Screen name="live/[deviceId]" options={{ headerShown: true, title: 'Live view', ...HEADER }} />
            <Stack.Screen name="messages/[deviceId]" options={{ headerShown: true, title: 'Voice messages', ...HEADER }} />
            <Stack.Screen name="admin/[id]" options={{ headerShown: true, title: 'Administrator', ...HEADER }} />
            {/* A call covers the whole screen and can't be swiped away by accident. */}
            <Stack.Screen name="call/[deviceId]" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="photos" options={{ headerShown: true, title: 'Photo Record', ...HEADER }} />
            <Stack.Screen name="videos" options={{ headerShown: true, title: 'Video Record', ...HEADER }} />
            <Stack.Screen name="wifi" options={{ headerShown: true, title: 'Site Wi-Fi', ...HEADER }} />
            <Stack.Screen name="conference" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen
              name="fences"
              options={{ headerShown: true, title: 'Fences', ...HEADER }}
            />
            <Stack.Screen
              name="fence/[id]"
              options={{ headerShown: true, title: 'Fence', ...HEADER }}
            />
            <Stack.Screen
              name="security"
              options={{ headerShown: true, title: 'Account security', ...HEADER }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>
        </AlarmChrome>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

const HEADER = {
  headerTintColor: '#0C352F',
  headerBackTitle: 'Back',
  headerTitleStyle: { fontFamily: 'Epilogue_700Bold', fontSize: 17 },
  headerStyle: { backgroundColor: '#F8FAFC' },
  headerShadowVisible: false,
} as const
