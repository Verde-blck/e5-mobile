import { useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  describeAuthError,
  login,
  verifyTwoFactorLogin,
  type TwoFactorChallenge,
} from '@/modules/auth/api/auth.api'
import { AuthButton, AuthField, AuthHelmetMark, AuthLink, INK, PAGE, ink, rgba } from '@/modules/auth/components/AuthKit'
import { env } from '@/config/env'
import { BrandConstellation } from '@/shared/components/BrandConstellation'
import { useBrandColours, useBranding } from '@/modules/branding/hooks/useBranding'
import { CompanyLogo } from '@/shared/components/Logo'
import { Text } from '@/shared/components/Text'
import { useAuthStore } from '@/shared/store/authStore'

/*
 * The sign-in screen, laid out as the web dashboard's sign-in page (AuthLayout.tsx) so the two look like one product. Every measurement
 * below is that page's, read from it in a browser.
 *
 *   Under 640 wide    a 224 tall banner with the card overlapping its lower edge by 40, the card as wide as the screen allows.
 *   640 and up        the same, with a 256 tall banner, larger type, and a 400 wide card.
 *   1024 and up       two panes: the panel on the left (5 parts of 12), the card centred in the rest (7 parts).
 *
 * (These are the web page's own widths, not the app's tablet breakpoints, which are for the lists and detail screens.)
 */
export default function SignInScreen() {
  const branding = useBranding()
  const brand = useBrandColours()
  const insets = useSafeAreaInsets()
  const setUser = useAuthStore((s) => s.setUser)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const canSubmitCredentials = username.trim().length > 0 && password.length > 0
  const canSubmitCode = code.length === 6

  async function submitCredentials() {
    if (busy) return
    // Like the web page's form: the button is always there, and pressing it with something missing says what.
    if (!canSubmitCredentials) {
      setUsernameError(username.trim() ? null : 'Enter your username.')
      setPasswordError(password ? null : 'Enter your password.')
      return
    }
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
    if (!challenge || busy) return
    if (!canSubmitCode) {
      setError('Enter the 6-digit code.')
      return
    }
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
    setUsernameError(null)
    setPasswordError(null)
  }

  const { width } = useWindowDimensions()
  const sm = width >= 640
  const split = width >= 1024

  const hero = (
    <View
      testID="signin-hero"
      style={[
        { backgroundColor: brand.secondary, overflow: 'hidden' },
        // A banner is tall enough for its content plus the status bar above it; the panel fills its half.
        split ? { flex: 5 } : { height: (sm ? 256 : 224) + insets.top },
      ]}
    >
      <BrandConstellation />
      <View
        style={{
          flex: 1,
          justifyContent: 'space-between',
          paddingHorizontal: split ? 48 : sm ? 32 : 24,
          paddingTop: insets.top + (split ? 40 : 20),
          paddingBottom: split ? 40 : sm ? 80 : 72,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AuthHelmetMark colour={brand.secondary} />
          <Text className="font-sans-medium" style={{ fontSize: 14, lineHeight: 20, color: 'rgba(255, 255, 255, 0.9)' }}>
            {branding.companyName ?? 'E5 Energy'}
          </Text>
        </View>

        <View style={{ maxWidth: 448 }}>
          {(() => {
            const size = split ? 52 : sm ? 40 : 32
            return (
              <Text testID="signin-title" className="font-display" style={{ fontSize: size, lineHeight: size * 1.05, letterSpacing: -0.02 * size, color: '#FFFFFF' }}>
                Command Centre
              </Text>
            )
          })()}
          {sm ? (
            <Text style={{ marginTop: 12, maxWidth: 384, fontSize: 15, lineHeight: 24.375, color: brand.mint }}>
              Live location, alarms and gas readings for every helmet in the fleet.
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )

  const card = (
    <>
      <View style={{ marginBottom: 24 }}>
        <CompanyLogo width={sm ? 86 : 79} />
        {branding.secondaryColor ? <View accessibilityLabel="Company accent" style={{ marginTop: 8, height: 3, width: 44, borderRadius: 2, backgroundColor: branding.secondaryColor }} /> : null}
      </View>
      {challenge ? (
        <>
          <Heading>Two-step verification</Heading>
          <Subheading>Enter the 6-digit code from your authenticator app for {challenge.username}.</Subheading>
          <AuthField
            label="Authentication code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            placeholder="000000"
            code
            onSubmitEditing={submitCode}
            error={error}
          />
          <AuthButton title="Verify and sign in" busy={busy} onPress={submitCode} />
          <View style={{ marginTop: 8 }}>
            <AuthLink title="Use a different account" onPress={backToCredentials} />
          </View>
        </>
      ) : (
        <>
          <Heading>Sign in</Heading>
          <Subheading>Use the username and password your administrator gave you.</Subheading>
          <AuthField
            label="Username"
            icon="user"
            value={username}
            error={usernameError}
            onChangeText={(v) => {
              setUsername(v)
              setUsernameError(null)
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
          />
          <AuthField
            label="Password"
            icon="lock"
            value={password}
            onChangeText={(v) => {
              setPassword(v)
              setPasswordError(null)
            }}
            secret
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submitCredentials}
            error={passwordError ?? error}
          />
          <AuthButton title="Sign in" busy={busy} onPress={submitCredentials} />
        </>
      )}
    </>
  )

  const footer = (
    <>
      {env.useMocks ? (
        <View style={{ marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', padding: 14 }}>
          <Text className="font-sans-semibold" style={{ fontSize: 12, color: '#78350F' }}>
            Sample data mode - no server needed
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12, lineHeight: 20, color: '#92400E' }}>
            ADM-001 (full access), AD-001 (administers, not a super admin), OP-014 (restricted),
            RO-001 (view-only settings), MFA-001 (two-step; code 123456), SETUP-001 (must set up two-step). Any password works.
          </Text>
        </View>
      ) : null}

      <Text style={{ marginTop: 20, paddingHorizontal: 4, textAlign: 'center', fontSize: 13, lineHeight: 21.125, color: ink(0.7) }}>
        {challenge ? 'Lost access to your authenticator app? Your administrator can reset it.' : 'Accounts are issued by your administrator.'}
      </Text>
    </>
  )

  const cardBox = (
    <View
      testID="signin-card"
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: ink(0.06),
        backgroundColor: '#FFFFFF',
        padding: sm ? 32 : 24,
        // The web page's shadow: a hairline, and a soft one that falls away to the bottom.
        boxShadow: `0 1px 2px ${rgba(brand.secondary, 0.06)}, 0 12px 32px -12px ${rgba(brand.secondary, 0.18)}`,
      }}
    >
      {card}
    </View>
  )

  const column = (
    <View style={{ alignSelf: 'center', width: '100%', maxWidth: 400 }}>
      {cardBox}
      {footer}
    </View>
  )

  if (split) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: PAGE }}>
        <StatusBar style="light" />
        {hero}
        <KeyboardAvoidingView style={{ flex: 7 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 }}>
            {column}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ flexGrow: 1 }}>
          {hero}
          {/* The card overlaps the banner by 40. */}
          <View style={{ marginTop: -40, paddingHorizontal: sm ? 24 : 16, paddingBottom: 48 }}>{column}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <Text testID="signin-heading" accessibilityRole="header" className="font-display" style={{ fontSize: 26, lineHeight: 32.5, letterSpacing: -0.26, color: INK }}>
      {children}
    </Text>
  )
}

function Subheading({ children }: { children: ReactNode }) {
  // 28 below it, to the first field: the web page's mt-7.
  return <Text style={{ marginTop: 6, marginBottom: 28, fontSize: 14, lineHeight: 22.75, color: ink(0.7) }}>{children}</Text>
}
