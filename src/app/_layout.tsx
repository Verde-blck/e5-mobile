import '../../global.css'

import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider, focusManager } from '@tanstack/react-query'

// One import per weight, not the package root: the root re-exports every
// weight of the family and Metro would bundle all of those font files.
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
import { BrandTheme } from '@/modules/branding/components/BrandTheme'
import { PhoneBlockedScreen } from '@/shared/components/PhoneBlockedScreen'
import { useTabletGate } from '@/shared/lib/useTabletGate'
import { prefetchBranding } from '@/modules/branding/hooks/useBranding'
import { queryClient } from '@/shared/lib/query-client'
import { endSession } from '@/shared/lib/session'
import { onPasswordChangeRequired, onSetupRequired, onUnauthorized } from '@/shared/lib/unauthorized'
import { useAuthStore } from '@/shared/store/authStore'

// Hold the native splash screen until fonts and the saved session are ready, so
// there's no flash of a signed-out screen for someone who is signed in.
void SplashScreen.preventAutoHideAsync()

// React Query refetches on focus: in a browser that is the tab, on a phone it is the app being in the
// foreground. Wiring it to AppState stops polling when the phone is locked or the app is backgrounded.
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
  const gate = useTabletGate()
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // Until 2FA is set up the backend refuses everything but sign-in and the profile, so only
  // the set-up screen shows and nothing that would be refused (alarm stream, push) runs.
  // The same goes for a temporary password: the backend refuses everything until the person has chosen their own.
  const mustSetup = useAuthStore((s) => s.user?.mustSetup2fa === true)
  const mustChange = useAuthStore((s) => s.user?.mustChangePassword === true)
  const usable = isAuthenticated && !mustSetup && !mustChange

  useEffect(() => {
    if (gate.blocked) {
      useAuthStore.getState().setBootstrapping(false)
      return
    }
    let alive = true
    void (async () => {
      try {
        const [user] = await Promise.all([restoreSession(), prefetchBranding(queryClient)])
        if (alive) useAuthStore.getState().setUser(user)
      } finally {
        if (alive) useAuthStore.getState().setBootstrapping(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate.blocked])

  useEffect(() => onUnauthorized(() => void endSession()), [])

  // "Set up 2FA first" is not a dead token: send the person to set it up, never sign them out.
  useEffect(() => onSetupRequired(() => useAuthStore.getState().requireSetup()), [])
  useEffect(() => onPasswordChangeRequired(() => useAuthStore.getState().requirePasswordChange()), [])

  const ready = (fontsLoaded || !!fontError) && !isBootstrapping

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null
  if (gate.blocked) return <PhoneBlockedScreen smallestDp={gate.smallestDp} />

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <BrandTheme>
        <StatusBar style="dark" />
        {usable ? <LiveAlarms /> : null}
        {usable ? <PushRuntime /> : null}
        <AlarmChrome>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={usable}>
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
          {/* A temporary password comes first: it is the account's most basic safeguard, and two-step set-up is asked for after it. */}
          <Stack.Protected guard={isAuthenticated && mustChange}>
            <Stack.Screen name="change-password" />
          </Stack.Protected>
          <Stack.Protected guard={isAuthenticated && mustSetup && !mustChange}>
            <Stack.Screen name="setup-2fa" />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>
        </AlarmChrome>
        </BrandTheme>
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
