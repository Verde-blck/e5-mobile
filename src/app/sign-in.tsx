import { useRef, useState } from 'react'
import { View } from 'react-native'
import { describeAuthError, login, verifyTwoFactorLogin, type TwoFactorChallenge } from '@/modules/auth/api/auth.api'
import { AuthButton, AuthField, AuthLink } from '@/modules/auth/components/AuthKit'
import { AuthFooterText, AuthHeading, AuthScreen, AuthSubheading } from '@/modules/auth/components/AuthScreen'
import { cleanCode, codeRefusal, isCompleteCode } from '@/modules/auth/lib/code'
import { env } from '@/config/env'
import { Text } from '@/shared/components/Text'
import { useAuthStore } from '@/shared/store/authStore'

export default function SignInScreen() {
  const setUser = useAuthStore((s) => s.setUser)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null)
  const [busy, setBusy] = useState(false)
  // `busy` is state, so it can lag a moment behind: this stops two requests being sent at once.
  const inFlight = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const canSubmitCredentials = username.trim().length > 0 && password.length > 0

  async function submitCredentials() {
    if (busy || inFlight.current) return
    if (!canSubmitCredentials) {
      setUsernameError(username.trim() ? null : 'Enter your username.')
      setPasswordError(password ? null : 'Enter your password.')
      return
    }
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await login({ username: username.trim(), password })
      if (result.status === 'needs-code') {
        setChallenge(result.challenge)
        setCode('')
      } else {
        setUser(result.user)
      }
    } catch (e) {
      setError(describeAuthError(e, 'Wrong username or password.'))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  // `entered` is the code when it is submitted the moment the sixth digit lands, before the state has caught up.
  async function submitCode(entered?: string) {
    const value = entered ?? code
    if (!challenge || busy || inFlight.current) return
    if (!isCompleteCode(value)) {
      setError('Enter the 6-digit code.')
      return
    }
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      setUser(await verifyTwoFactorLogin(challenge, value))
    } catch (e) {
      const refusal = codeRefusal(e)
      setError(refusal.message)
      setCode('')
      if (refusal.freshChallenge) await refreshChallenge()
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  // The server may spend a login challenge on the first attempt, or let it expire, so after a refused code the next try gets a new one.
  // If that fails too, the old one stays and the message already says what to do.
  async function refreshChallenge() {
    try {
      const result = await login({ username: username.trim(), password })
      if (result.status === 'needs-code') setChallenge(result.challenge)
      else setUser(result.user)
    } catch {
      /* keep the old challenge */
    }
  }

  function backToCredentials() {
    setChallenge(null)
    setCode('')
    setError(null)
    setUsernameError(null)
    setPasswordError(null)
  }

  const card = (
    <>
      {challenge ? (
        <>
          <AuthHeading>Two-step verification</AuthHeading>
          <AuthSubheading>Enter the 6-digit code from your authenticator app for {challenge.username}.</AuthSubheading>
          <AuthField
            label="Authentication code"
            value={code}
            onChangeText={(v) => {
              // A number keypad has no Go key, so the sixth digit sends the code; an autofilled or pasted code does too.
              const next = cleanCode(v)
              setCode(next)
              if (isCompleteCode(next)) void submitCode(next)
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            placeholder="000000"
            code
            onSubmitEditing={() => void submitCode()}
            error={error}
          />
          <AuthButton title="Verify and sign in" busy={busy} onPress={() => void submitCode()} />
          {busy ? <Text accessibilityLiveRegion="polite" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: '#64748B' }}>Checking the code...</Text> : null}
          <View style={{ marginTop: 8 }}>
            <AuthLink title="Use a different account" onPress={backToCredentials} />
          </View>
        </>
      ) : (
        <>
          <AuthHeading>Sign in</AuthHeading>
          <AuthSubheading>Use the username and password your administrator gave you.</AuthSubheading>
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
          {busy ? <Text accessibilityLiveRegion="polite" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: '#64748B' }}>Signing in...</Text> : null}
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
            RO-001 (view-only settings), MFA-001 (two-step; code 123456), SETUP-001 (must set up two-step),
            NEW-001 (must set their own password). Any password works.
          </Text>
        </View>
      ) : null}

      <AuthFooterText>
        {challenge ? 'Lost access to your authenticator app? Your administrator can reset it.' : 'Accounts are issued by your administrator.'}
      </AuthFooterText>
    </>
  )

  return <AuthScreen footer={footer}>{card}</AuthScreen>
}
