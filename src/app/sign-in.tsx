import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  describeAuthError,
  login,
  verifyTwoFactorLogin,
  type TwoFactorChallenge,
} from '@/modules/auth/api/auth.api'
import { env } from '@/config/env'
import { Button } from '@/shared/components/Button'
import { Container } from '@/shared/components/Container'
import { Logo } from '@/shared/components/Logo'
import { Text } from '@/shared/components/Text'
import { TextField } from '@/shared/components/TextField'
import { cn } from '@/shared/lib/cn'
import { useLayout } from '@/shared/lib/layout'
import { useAuthStore } from '@/shared/store/authStore'

export default function SignInScreen() {
  const insets = useSafeAreaInsets()
  // A tablet in landscape splits the screen: the brand on one side, the form on the other.
  const { twoPane } = useLayout()
  const setUser = useAuthStore((s) => s.setUser)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmitCredentials = username.trim().length > 0 && password.length > 0
  const canSubmitCode = code.length === 6

  async function submitCredentials() {
    if (!canSubmitCredentials || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await login({ username: username.trim(), password })
      if (result.status === 'needs-code') {
        setChallenge(result.challenge)
        setCode('')
      } else {
        // Flipping the user is what moves the app past the sign-in screen:
        // the root layout's route guards react to it.
        setUser(result.user)
      }
    } catch (e) {
      setError(describeAuthError(e, 'Wrong username or password.'))
    } finally {
      setBusy(false)
    }
  }

  async function submitCode() {
    if (!challenge || !canSubmitCode || busy) return
    setBusy(true)
    setError(null)
    try {
      setUser(await verifyTwoFactorLogin(challenge, code))
    } catch (e) {
      setError(describeAuthError(e, "That code didn't work. Check your authenticator app."))
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  function backToCredentials() {
    setChallenge(null)
    setCode('')
    setError(null)
  }

  const hero = (
    <LinearGradient
      colors={['#0C352F', '#0A6659']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={
        twoPane
          ? { flex: 1, justifyContent: 'space-between', padding: 48, paddingTop: insets.top + 40, paddingBottom: 56 }
          : { paddingTop: insets.top + 24, paddingBottom: 56, paddingHorizontal: 24 }
      }
    >
      <Logo />
      <View className={twoPane ? undefined : 'mt-10'}>
        <Text
          className={cn(
            'font-display-bold text-white',
            twoPane ? 'text-5xl leading-[54px]' : 'text-3xl leading-9'
          )}
        >
          Fleet safety,{'\n'}always in view.
        </Text>
        <Text className={cn('mt-3 leading-6 text-white/75', twoPane ? 'text-lg' : 'text-base')}>
          Monitor helmets, alarms and live locations in one place.
        </Text>
      </View>
    </LinearGradient>
  )

  const form = (
    <>
      {challenge ? (
        <>
          <Text className="font-display-bold text-2xl">Two-step verification</Text>
          <Text className="mb-6 mt-1.5 text-sm leading-5 text-slate-600">
            Enter the 6-digit code from your authenticator app for {challenge.username}.
          </Text>
          <TextField
            label="Authentication code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            mono
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            placeholder="123456"
            onSubmitEditing={submitCode}
            error={error}
          />
          <Button
            title="Verify and sign in"
            className="mt-5"
            loading={busy}
            disabled={!canSubmitCode}
            onPress={submitCode}
          />
          <Button
            title="Use a different account"
            variant="ghost"
            className="mt-2"
            onPress={backToCredentials}
          />
        </>
      ) : (
        <>
          <Text className="font-display-bold text-2xl">Sign in</Text>
          <Text className="mb-6 mt-1.5 text-sm leading-5 text-slate-600">
            Use the username and password your administrator gave you.
          </Text>
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
          />
          <TextField
            className="mt-4"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secret
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submitCredentials}
            error={error}
          />
          <Button
            title="Sign in"
            className="mt-6"
            loading={busy}
            disabled={!canSubmitCredentials}
            onPress={submitCredentials}
          />
        </>
      )}

      {env.useMocks ? (
        <View className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <Text className="font-sans-semibold text-xs text-amber-900">
            Sample data mode — no server needed
          </Text>
          <Text className="mt-1 text-xs leading-5 text-amber-800">
            ADM-001 (full access), OP-014 (restricted), RO-001 (view-only settings),
            MFA-001 (two-step; code 123456). Any password works.
          </Text>
        </View>
      ) : null}

      <Text className="mt-8 text-center text-xs text-slate-400">
        Accounts are issued by your administrator.
      </Text>
    </>
  )

  if (twoPane) {
    return (
      <View className="flex-1 flex-row bg-slate-50">
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>{hero}</View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="flex-grow justify-center px-12 py-10"
          >
            <Container max={420}>{form}</Container>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          bounces={false}
          contentContainerClassName="flex-grow"
        >
          {hero}
          <View className="-mt-6 flex-1 rounded-t-3xl bg-slate-50 px-6 pb-10 pt-8">
            <Container max={480}>{form}</Container>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
