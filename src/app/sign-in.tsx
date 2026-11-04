import { useState } from 'react'
import { View } from 'react-native'
import { describeAuthError, login, verifyTwoFactorLogin, type TwoFactorChallenge } from '@/modules/auth/api/auth.api'
import { AuthButton, AuthField, AuthLink } from '@/modules/auth/components/AuthKit'
import { AuthFooterText, AuthHeading, AuthScreen, AuthSubheading } from '@/modules/auth/components/AuthScreen'
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
  const [error, setError] = useState<string | null>(null)

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const canSubmitCredentials = username.trim().length > 0 && password.length > 0
  const canSubmitCode = code.length === 6

  async function submitCredentials() {
    if (busy) return
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

  const card = (
    <>
      {challenge ? (
        <>
          <AuthHeading>Two-step verification</AuthHeading>
          <AuthSubheading>Enter the 6-digit code from your authenticator app for {challenge.username}.</AuthSubheading>
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
