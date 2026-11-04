import { useState } from 'react'
import { View } from 'react-native'
import { changeOwnPassword, passwordChangeError, refreshProfile } from '@/modules/auth/api/auth.api'
import { AuthButton, AuthField, AuthFormError, AuthLink } from '@/modules/auth/components/AuthKit'
import { AuthFooterText, AuthHeading, AuthScreen, AuthSubheading } from '@/modules/auth/components/AuthScreen'
import { validatePasswordChange, type PasswordChangeErrors } from '@/modules/auth/lib/password'
import { endSession } from '@/shared/lib/session'
import { useAuthStore } from '@/shared/store/authStore'

// Shown instead of the app while an account has a temporary password, whether it was just issued or an administrator reset it
// while the person was signed in: the backend refuses everything else until they choose their own.
export default function ChangePasswordRoute() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<PasswordChangeErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy || !user) return
    const found = validatePasswordChange({ current, next, confirm })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    setFormError(null)
    try {
      await changeOwnPassword({ currentPassword: current, newPassword: next }, user.username)
    } catch (error) {
      setFormError(passwordChangeError(error))
      setBusy(false)
      return
    }
    // Let them in at once, then ask the server what they may do now: it can still want two-step verification set up.
    setUser({ ...user, mustChangePassword: false })
    try {
      setUser(await refreshProfile(user.username))
    } catch {
      /* a 401 ends the session through the API client; anything else keeps the current user until the next try */
    }
  }

  const field = (set: (v: string) => void, key: keyof PasswordChangeErrors) => (v: string) => {
    set(v)
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const card = (
    <>
      <AuthHeading>Set your own password</AuthHeading>
      <AuthSubheading>Your account has a temporary password. Choose your own before you continue.</AuthSubheading>
      <AuthFormError message={formError} />
      <AuthField
        label="Current password"
        icon="lock"
        value={current}
        onChangeText={field(setCurrent, 'current')}
        error={errors.current}
        secret
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
      />
      <AuthField
        label="New password"
        icon="lock"
        value={next}
        onChangeText={field(setNext, 'next')}
        error={errors.next}
        secret
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />
      <AuthField
        label="Confirm new password"
        icon="lock"
        value={confirm}
        onChangeText={field(setConfirm, 'confirm')}
        error={errors.confirm}
        secret
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <AuthButton title="Set password and continue" busyTitle="Saving..." busy={busy} onPress={submit} />
    </>
  )

  const footer = (
    <View style={{ marginTop: 12 }}>
      <AuthFooterText>Not now?</AuthFooterText>
      <AuthLink title="Sign out" onPress={() => void endSession()} />
    </View>
  )

  return <AuthScreen footer={footer}>{card}</AuthScreen>
}
