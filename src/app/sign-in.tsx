import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
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
import { AppCanvas } from '@/shared/components/AppCanvas'
import { BrandConstellation } from '@/shared/components/BrandConstellation'
import { CompanyLogo, Logo } from '@/shared/components/Logo'
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

  const { width, height } = useWindowDimensions()
  // A tablet in portrait has room for a taller banner and larger type than a phone.
  const roomy = width >= 600
  // Portrait: the hero is a banner and the card overlaps its lower edge. Wide (a large tablet, or the
  // browser preview): the hero is a full-height panel beside the card.
  const bannerHeight = Math.round(Math.min(Math.max(height * (roomy ? 0.4 : 0.34), 270), roomy ? 520 : 360))

  const hero = (
    <View style={twoPane ? { flex: 1, overflow: 'hidden' } : { height: bannerHeight, overflow: 'hidden' }}>
      <BrandConstellation />
      <View
        style={{
          flex: 1,
          justifyContent: 'space-between',
          paddingHorizontal: twoPane ? 48 : roomy ? 40 : 24,
          paddingTop: insets.top + (twoPane ? 40 : 18),
          paddingBottom: twoPane ? 56 : 54,
        }}
      >
        <Logo />
        <View>
          <Text className={twoPane ? 'font-display-extrabold text-6xl leading-[64px] text-white' : roomy ? 'font-display-extrabold text-5xl leading-[56px] text-white' : 'font-display-extrabold text-4xl leading-[42px] text-white'}>
            Command Centre
          </Text>
          <Text className={twoPane ? 'mt-4 max-w-sm text-lg leading-7 text-brand-soft' : roomy ? 'mt-3 max-w-md text-lg leading-7 text-brand-soft' : 'mt-2 text-[15px] leading-6 text-brand-soft'}>
            Live location, alarms and gas readings for every helmet in the fleet.
          </Text>
        </View>
      </View>
    </View>
  )

  const card = (
    <>
      <CompanyLogo width={92} />
      <View className="h-5" />
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
            placeholder="000000"
            code
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

    </>
  )

  const footer = (
    <>
      {env.useMocks ? (
        <View className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <Text className="font-sans-semibold text-xs text-amber-900">
            Sample data mode — no server needed
          </Text>
          <Text className="mt-1 text-xs leading-5 text-amber-800">
            ADM-001 (full access), OP-014 (restricted), RO-001 (view-only settings),
            MFA-001 (two-step; code 123456). Any password works.
          </Text>
        </View>
      ) : null}

      <Text className="mt-6 px-4 text-center text-sm leading-5 text-slate-500">
        {challenge
          ? 'Lost access to your authenticator app? Your administrator can reset it.'
          : 'Accounts are issued by your administrator.'}
      </Text>
    </>
  )

  const cardBox = 'rounded-3xl bg-white p-7 shadow-lg shadow-slate-900/10'

  if (twoPane) {
    return (
      <View className="flex-1 flex-row" style={{ backgroundColor: '#F2F8F8' }}>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>{hero}</View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <AppCanvas />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="flex-grow justify-center px-12 py-10">
            <Container max={420}>
              <View className={cardBox}>{card}</View>
              {footer}
            </Container>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#F2F8F8' }}>
      <StatusBar style="light" />
      <AppCanvas />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerClassName="flex-grow">
          {hero}
          <View className="-mt-9 px-4 pb-10">
            <Container max={480}>
              <View className={cardBox}>{card}</View>
              {footer}
            </Container>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
